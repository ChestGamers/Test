const tooltip = document.querySelector('.tooltip');
const keys = document.querySelectorAll('.key');
const popupBg = document.querySelector('.info__bg');
const popup = document.querySelector('.info');

keys.forEach(key => {
	key.addEventListener('click', function() {
		popup.querySelector('.info__photo').setAttribute('src', this.dataset.photo);
		popup.querySelector('.info_title').innerText = this.dataset.title;
		popup.querySelector('.info__text').innerText = this.dataset.description;
		popupBg.classList.add('active');
	});

	key.addEventListener('mousemove', function(e) {
		tooltip.innerText = this.dataset.title
        tooltip.style.top = (e.y + 20) + 'px';
        tooltip.style.left = (e.x + 20) + 'px';
	});

	key.addEventListener('mouseenter', function() {
		tooltip.style.display = 'block';
	});

	key.addEventListener('mouseleave', function() {
		tooltip.style.display = 'none';
	});
});

document.addEventListener('click', (e) => {
	if(e.target === popupBg) {
		popupBg.classList.remove('active');
	}
});