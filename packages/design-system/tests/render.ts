import { type ReactElement, act } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const render = (element: ReactElement) => {
  const container = globalThis.document.createElement('div');
  globalThis.document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    rerender: (next: ReactElement) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const click = (element: Element) => {
  act(() => {
    element.dispatchEvent(new globalThis.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
};

const requireElement = (container: ParentNode, selector: string): Element => {
  const element = container.querySelector(selector);
  if (element === null) {
    throw new Error(`Element not found for selector: ${selector}`);
  }
  return element;
};

export { click, render, requireElement };
