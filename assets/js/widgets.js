(() => {
  const kind = new URLSearchParams(location.search).get('widget');
  const template = [...document.querySelectorAll('template')].find(node => node.dataset.kind === kind);
  if (template) document.querySelector('#widget-root').append(template.content.cloneNode(true));
})();
