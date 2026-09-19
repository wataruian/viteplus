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

const localSonarRunner = (
  dockerSocket: Socket,
  scanRoot: Directory,
  sonarToken: Secret,
  hostUrl: string,
  sonarArgs: string,
  projectKey: string,
): { container: Container; reportTaskPath: string } => {
  const pollScript = [
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
    'echo "$task_json" > /tmp/ce-task.json',
    `analysis_id=$(echo "$task_json" | grep -o '"analysisId":"[^"]*"' | cut -d'"' -f4 || true)`,
    'if [ -n "$analysis_id" ]; then',
    `  curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/qualitygates/project_status?analysisId=\${analysis_id}" > /tmp/sonar-quality-gate.json`,
    'fi',
    `curl -s -u "\${SONAR_TOKEN}:" "\${SONAR_HOST_URL}/api/issues/search?componentKeys=${projectKey}&resolved=false&ps=50" > /tmp/sonar-issues.json`,
  ].join('\n');

  const orchestrationScript = [
    'set -eu',
    `container_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -w /usr/src ${SONAR_SCANNER_IMAGE} sonar-scanner ${sonarArgs})`,
    `docker cp /usr/src/. "\${container_id}:/usr/src"`,
    `docker start "\${container_id}" >/dev/null`,
    `docker logs -f "\${container_id}" 2>&1`,
    `exit_code=$(docker wait "\${container_id}")`,
    `docker cp "\${container_id}:${SONAR_WORKING_DIRECTORY}/report-task.txt" /tmp/report-task.txt 2>/dev/null || true`,
    `docker rm "\${container_id}" >/dev/null`,
    `echo "\${exit_code}" > /tmp/sonar.exit-code`,
    '',
    'if [ -f /tmp/report-task.txt ]; then',
    `  ce_task_id=$(grep "^ceTaskId=" /tmp/report-task.txt | cut -d= -f2-)`,
    `  poll_id=$(docker create --network ${SONAR_LOCAL_DOCKER_NETWORK} -e SONAR_HOST_URL -e SONAR_TOKEN -e CE_TASK_ID="\${ce_task_id}" --entrypoint sh ${CURL_IMAGE} /poll.sh)`,
    `  docker cp /poll.sh "\${poll_id}:/poll.sh"`,
    `  docker start -a "\${poll_id}" || true`,
    `  docker cp "\${poll_id}:/tmp/sonar-quality-gate.json" /tmp/sonar-quality-gate.json 2>/dev/null || true`,
    `  docker cp "\${poll_id}:/tmp/sonar-issues.json" /tmp/sonar-issues.json 2>/dev/null || true`,
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

  return { container, reportTaskPath: '/tmp/report-task.txt' };
};

const remoteSonarRunner = (
  scanRoot: Directory,
  sonarToken: Secret,
  hostUrl: string,
  sonarArgs: string,
): { container: Container; reportTaskPath: string } => {
  const container = dag
    .container()
    .from(SONAR_SCANNER_IMAGE)
    .withWorkdir('/usr/src')
    .withDirectory('/usr/src', scanRoot, { owner: SONAR_SCANNER_USER })
    .withSecretVariable('SONAR_TOKEN', sonarToken)
    .withEnvVariable('SONAR_HOST_URL', hostUrl)
    .withExec(['sh', '-c', `sonar-scanner ${sonarArgs} 2>&1; echo $? > /tmp/sonar.exit-code`], {
      expect: ReturnType.Any,
    });

  return { container, reportTaskPath: `${SONAR_WORKING_DIRECTORY}/report-task.txt` };
};

export { localSonarRunner, remoteSonarRunner };
