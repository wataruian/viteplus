import {
  type Container,
  type Directory,
  ReturnType,
  type Secret,
  type Socket,
  dag,
} from '@dagger.io/dagger';

import {
  CURL_IMAGE,
  DOCKER_CLI_VERSION,
  SONAR_LOCAL_DOCKER_NETWORK,
  SONAR_SCANNER_IMAGE,
  SONAR_SCANNER_USER,
  SONAR_WORKING_DIRECTORY,
} from './constants';

interface SonarRunResult {
  container: Container;
  reportTaskPath: string;
  exitCodePath: string;
}

const POLL_CONTAINER_HOME = '/home/curl_user';
const LOCAL_ORCHESTRATOR_HOME = '/root';

const REPORT_FILE_NAMES = ['sonar-quality-gate.json', 'sonar-issues.json'];

const buildPollScript = (projectKey: string, outputDir: string): string =>
  [
    'set -eu',
    'task_status=""',
    'i=0',
    'while [ "$i" -lt 30 ]; do',
    `  task_json=$(curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/ce/task?id=\${CE_TASK_ID}")`,
    `  task_status=$(echo "$task_json" | grep -o '"status":"[A-Z]*"' | head -1 | cut -d'"' -f4)`,
    '  case "$task_status" in',
    '    SUCCESS|FAILED|CANCELED) break ;;',
    '  esac',
    '  i=$((i + 1))',
    '  sleep 3',
    'done',
    `echo "$task_json" > ${outputDir}/ce-task.json`,
    `analysis_id=$(echo "$task_json" | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4 || true)`,
    'if [ -n "$analysis_id" ]; then',
    `  curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=\${analysis_id}" > ${outputDir}/sonar-quality-gate.json`,
    'fi',
    `curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/issues/search?componentKeys=${projectKey}&resolved=false&ps=50" > ${outputDir}/sonar-issues.json`,
  ].join('\n');

const attachReportFiles = async (
  container: Container,
  outputDir: string,
  result: Directory,
): Promise<Directory> => {
  let attached = result;

  const files = await Promise.all(
    REPORT_FILE_NAMES.map(async (fileName) => {
      const file = container.file(`${outputDir}/${fileName}`);
      try {
        await file.contents();
        return { file, fileName };
      } catch {
        return undefined;
      }
    }),
  );

  for (const entry of files) {
    if (entry !== undefined) {
      attached = attached.withFile(entry.fileName, entry.file);
    }
  }

  return attached;
};

const pollQualityGate = (
  sonarToken: Secret,
  hostUrl: string,
  projectKey: string,
  ceTaskId: string,
): Container =>
  dag
    .container()
    .from(CURL_IMAGE)
    .withSecretVariable('SONAR_TOKEN', sonarToken)
    .withEnvVariable('SONAR_HOST_URL', hostUrl)
    .withEnvVariable('CE_TASK_ID', ceTaskId)
    .withExec(['sh', '-c', buildPollScript(projectKey, POLL_CONTAINER_HOME)]);

const localSonarRunner = (
  dockerSocket: Socket,
  scanRoot: Directory,
  sonarToken: Secret,
  hostUrl: string,
  sonarArgs: string,
  projectKey: string,
): SonarRunResult => {
  const pollScript = buildPollScript(projectKey, POLL_CONTAINER_HOME);

  const orchestrationScript = [
    'set -eu',
    `container_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -w /usr/src ${SONAR_SCANNER_IMAGE} sonar-scanner ${sonarArgs})`,
    `docker cp /usr/src/. "\${container_id}:/usr/src"`,
    `docker start "\${container_id}" >/dev/null`,
    `docker logs -f "\${container_id}" 2>&1`,
    `exit_code=$(docker wait "\${container_id}")`,
    `docker cp "\${container_id}:${SONAR_WORKING_DIRECTORY}/report-task.txt" ${LOCAL_ORCHESTRATOR_HOME}/report-task.txt 2>/dev/null || true`,
    `docker rm "\${container_id}" >/dev/null`,
    `echo "\${exit_code}" > ${LOCAL_ORCHESTRATOR_HOME}/sonar.exit-code`,
    '',
    `if [ -f ${LOCAL_ORCHESTRATOR_HOME}/report-task.txt ]; then`,
    `  ce_task_id=$(grep "^ceTaskId=" ${LOCAL_ORCHESTRATOR_HOME}/report-task.txt | cut -d= -f2-)`,
    `  poll_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -e CE_TASK_ID="\${ce_task_id}" --entrypoint sh ${CURL_IMAGE} /poll.sh)`,
    `  docker cp /poll.sh "\${poll_id}:/poll.sh"`,
    `  docker start -a "\${poll_id}" || true`,
    `  docker cp "\${poll_id}:${POLL_CONTAINER_HOME}/sonar-quality-gate.json" ${LOCAL_ORCHESTRATOR_HOME}/sonar-quality-gate.json 2>/dev/null || true`,
    `  docker cp "\${poll_id}:${POLL_CONTAINER_HOME}/sonar-issues.json" ${LOCAL_ORCHESTRATOR_HOME}/sonar-issues.json 2>/dev/null || true`,
    `  docker rm "\${poll_id}" >/dev/null`,
    'fi',
  ].join('\n');

  const container = dag
    .container()
    .from(DOCKER_CLI_VERSION)
    .withUnixSocket('/var/run/docker.sock', dockerSocket)
    .withNewFile('/poll.sh', pollScript)
    .withWorkdir('/usr/src')
    .withDirectory('/usr/src', scanRoot)
    .withEnvVariable('SONAR_HOST_URL', hostUrl)
    .withSecretVariable('SONAR_TOKEN', sonarToken)
    .withExec(['sh', '-c', orchestrationScript]);

  return {
    container,
    exitCodePath: `${LOCAL_ORCHESTRATOR_HOME}/sonar.exit-code`,
    reportTaskPath: `${LOCAL_ORCHESTRATOR_HOME}/report-task.txt`,
  };
};

const remoteSonarRunner = (
  scanRoot: Directory,
  sonarToken: Secret,
  hostUrl: string,
  sonarArgs: string,
): SonarRunResult => {
  const exitCodePath = '/usr/src/sonar.exit-code';

  const container = dag
    .container()
    .from(SONAR_SCANNER_IMAGE)
    .withWorkdir('/usr/src')
    .withDirectory('/usr/src', scanRoot, { owner: SONAR_SCANNER_USER })
    .withSecretVariable('SONAR_TOKEN', sonarToken)
    .withEnvVariable('SONAR_HOST_URL', hostUrl)
    .withExec(['sh', '-c', `sonar-scanner ${sonarArgs} 2>&1; echo $? > ${exitCodePath}`], {
      expect: ReturnType.Any,
    });

  return { container, exitCodePath, reportTaskPath: `${SONAR_WORKING_DIRECTORY}/report-task.txt` };
};

export {
  LOCAL_ORCHESTRATOR_HOME,
  POLL_CONTAINER_HOME,
  REPORT_FILE_NAMES,
  attachReportFiles,
  buildPollScript,
  localSonarRunner,
  pollQualityGate,
  remoteSonarRunner,
};
export type { SonarRunResult };
