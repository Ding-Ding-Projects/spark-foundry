const input = document.querySelector('#guide-search');
const sections = [...document.querySelectorAll('main section')];
const links = [...document.querySelectorAll('nav a')];
function filterGuide() {
  if (input.dataset.regexEnabled === 'true') { input.dispatchEvent(new Event('regex-refresh')); return; }
  const query = input.value.trim().toLocaleLowerCase();
  let matches = 0;
  for (const section of sections) {
    const visible = !query || section.textContent.toLocaleLowerCase().includes(query);
    section.hidden = !visible;
    if (visible) matches++;
    const link = links.find(item => item.getAttribute('href') === `#${section.id}`);
    if (link) link.hidden = !visible;
  }
  document.querySelector('#search-status').textContent = query ? `${matches} matching section${matches === 1 ? '' : 's'}` : '';
  document.querySelector('#no-results').hidden = matches !== 0;
}
input.addEventListener('input', filterGuide);
document.querySelector('#clear-search').addEventListener('click', () => { input.value = ''; filterGuide(); input.focus(); });
window.addEventListener('hashchange', () => {
  const target = document.getElementById(location.hash.slice(1));
  if (target?.hidden) { input.value = ''; filterGuide(); target.hidden = false; target.scrollIntoView(); }
});
