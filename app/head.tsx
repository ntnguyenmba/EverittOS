export default function Head() {
  const script = `
    (() => {
      const replacements = new Map([
        ['Simple role guide for this workspace.', 'Role guide'],
        ['Assign contractor', 'Assign team member'],
        ['5. Contractor', '5. Team member']
      ]);

      function applyCopy(root = document.body) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const node of nodes) {
          const value = node.nodeValue?.trim();
          if (!value || !replacements.has(value)) continue;
          node.nodeValue = node.nodeValue.replace(value, replacements.get(value));
        }
      }

      function start() {
        applyCopy();
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                const value = node.nodeValue?.trim();
                if (value && replacements.has(value)) {
                  node.nodeValue = node.nodeValue.replace(value, replacements.get(value));
                }
              } else if (node instanceof HTMLElement) {
                applyCopy(node);
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
      } else {
        start();
      }
    })();
  `;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
