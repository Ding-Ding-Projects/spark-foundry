const input = document.querySelector('#guide-search');
const sections = [...document.querySelectorAll('main section')];
const links = [...document.querySelectorAll('nav a')];
input.addEventListener('input', () => {
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
});
