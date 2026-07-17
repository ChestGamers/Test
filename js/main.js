document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА PANZOOM
    // ==========================================
    const panzoomElem = document.getElementById('panzoom-element');
    let panzoom;

    if (panzoomElem && typeof Panzoom !== 'undefined') {
        panzoom = Panzoom(panzoomElem, {
            maxScale: 6,
            minScale: 1,
            contain: 'outside',
            startScale: 1,
            excludeClass: 'key' // Клики по меткам не сбивают перетаскивание карты
        });

        panzoomElem.parentElement.addEventListener('wheel', (e) => {
            panzoom.zoomWithWheel(e);
        });
    }

    // ==========================================
    // 2. ДАННЫЕ МАРКЕРОВ И ИХ ДИНАМИЧЕСКИЙ РЕНДЕР
    // ==========================================
    let markersData = []; // Сюда загружаются и сохраняются все созданные точки
    let activeMapId = "farm"; 
    let currentFilter = "all";

    // Функция отрисовки динамических точек
    function renderDynamicMarkers() {
        const activeLayer = document.querySelector('.map-layer.active');
        if (!activeLayer) return;

        const dynamicLayer = activeLayer.querySelector('.dynamic-markers-layer');
        if (!dynamicLayer) return;

        // Полностью очищаем старые маркеры перед перерисовкой
        dynamicLayer.innerHTML = "";

        // Фильтруем маркеры по текущей карте и по категории
        const filtered = markersData.filter(marker => {
            const matchesMap = marker.map === activeMapId;
            const matchesCategory = currentFilter === "all" || marker.category === currentFilter;
            return matchesMap && matchesCategory;
        });

        // Строим круги в SVG для каждой подходящей точки
        filtered.forEach(marker => {
            const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            
            let className = "key";
            if (marker.category && marker.category !== "loot") {
                className += ` ${marker.category}`;
            }

            circle.setAttribute("class", className);
            circle.setAttribute("cx", marker.x);
            circle.setAttribute("cy", marker.y);
            circle.setAttribute("r", "25"); // Базовый размер круга
            
            // Записываем данные для тултипов и модалок
            circle.setAttribute("data-title", marker.title);
            circle.setAttribute("data-description", marker.desc || "Описание отсутствует");
            circle.setAttribute("data-photo", marker.image || "");
            circle.setAttribute("data-id", marker.id);

            dynamicLayer.appendChild(circle);
        });
    }

    // Автозагрузка файла JSON с сервера
    async function loadMarkers() {
        try {
            const response = await fetch('arena_breakout_markers.json');
            if (response.ok) {
                markersData = await response.json();
                console.log("Данные успешно подгружены из файла JSON.");
            }
        } catch (e) {
            console.log("Файл JSON пока отсутствует на сервере. Начни добавлять точки!");
        }
        renderDynamicMarkers();
    }

    // ==========================================
    // 3. ПЕРЕКЛЮЧЕНИЕ СЛОЕВ КАРТ И КАТЕГОРИЙ
    // ==========================================
    const filterButtons = document.querySelectorAll('.filter-btn');
    const armorySelect = document.getElementById('armory-select');
    const categorySelect = document.getElementById('category-filter');
    const mapLayers = document.querySelectorAll('.map-layer');

    function setActiveMap(mapId) {
        activeMapId = mapId;
        
        mapLayers.forEach(layer => layer.classList.remove('active'));
        
        const targetLayer = document.getElementById(`map-${mapId}`);
        if (targetLayer) {
            targetLayer.classList.add('active');
        }

        // Перерисовываем маркеры для выбранной карты
        renderDynamicMarkers();

        if (panzoom) {
            setTimeout(() => {
                panzoom.reset();
            }, 50);
        }
    }

    // Клик по кнопкам обычных карт
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => b.classList.remove('active'));
            if (armorySelect) armorySelect.value = ""; 

            this.classList.add('active');
            setActiveMap(this.getAttribute('data-map'));
        });
    });

    // Изменение этажей Арсенала в выпадающем списке
    if (armorySelect) {
        armorySelect.addEventListener('change', function () {
            if (this.value) {
                filterButtons.forEach(b => b.classList.remove('active'));
                setActiveMap(this.value);
            }
        });
    }

    // Фильтр категорий лута
    if (categorySelect) {
        categorySelect.addEventListener('change', function() {
            currentFilter = this.value;
            renderDynamicMarkers();
            if (tooltip) tooltip.style.display = 'none';
        });
    }

    // ==========================================
    // 4. ОКНО ИНФОРМАЦИИ (МОДАЛКА ЛУТА)
    // ==========================================
    const infoBg = document.querySelector('.info__bg');
    const infoClose = document.querySelector('.info__close');
    const infoPhoto = document.querySelector('.info__photo');
    const infoTitle = document.querySelector('.info_title');
    const infoText = document.querySelector('.info__text');

    // Открытие инфо-попапа при клике на метку (Event Delegation)
    if (panzoomElem) {
        panzoomElem.addEventListener('click', function (e) {
            const key = e.target.closest('.key');
            if (!key || isEditMode) return; // В режиме редактирования попап не открывается
            
            e.stopPropagation();

            const title = key.getAttribute('data-title');
            const description = key.getAttribute('data-description');
            const photoSrc = key.getAttribute('data-photo');

            if (infoTitle) infoTitle.textContent = title || "Без названия";
            if (infoText) infoText.textContent = description || "Описание отсутствует";
            
            if (infoPhoto) {
                if (photoSrc && photoSrc.trim() !== "") {
                    infoPhoto.src = photoSrc;
                    infoPhoto.style.display = 'block';
                } else {
                    infoPhoto.src = '';
                    infoPhoto.style.display = 'none';
                }
            }

            if (infoBg) infoBg.classList.add('active');
            if (tooltip) tooltip.style.display = 'none';
        });
    }

    // Закрытие модалки по клику на крестик
    if (infoClose) {
        infoClose.addEventListener('click', () => {
            if (infoBg) infoBg.classList.remove('active');
            if (infoPhoto) infoPhoto.classList.remove('zoomed'); // Сбрасываем зум картинки
        });
    }

    // Закрытие модалки по клику на темный фон вокруг
    if (infoBg) {
        infoBg.addEventListener('click', function (e) {
            if (e.target === this) {
                this.classList.remove('active');
                if (infoPhoto) infoPhoto.classList.remove('zoomed'); // Сбрасываем зум картинки
            }
        });
    }

    // Полноэкранный просмотр картинки при тапе/клике внутри попапа
    if (infoPhoto) {
        infoPhoto.addEventListener('click', function() {
            this.classList.toggle('zoomed');
        });
    }

    // ==========================================
    // 5. РЕЖИМ РЕДАКТОРА (СОЗДАНИЕ МАРКЕРОВ)
    // ==========================================
    let isEditMode = false;
    const toggleEditBtn = document.getElementById('toggle-edit');
    const exportBtn = document.getElementById('export-data');
    const modal = document.getElementById('marker-modal');
    const saveBtn = document.getElementById('save-marker');
    const cancelBtn = document.getElementById('cancel-marker');

    // Включение/выключение режима редактирования с проверкой пароля
    toggleEditBtn.addEventListener('click', () => {
        if (!isEditMode) {
            // Запрашиваем пароль при попытке активировать редактор
            const password = prompt("Введите пароль для редактирования карты:");
            
            if (password !== "admin123") { // Установи свой секретный пароль вместо admin123
                alert("Неверный пароль!");
                return;
            }
        }

        isEditMode = !isEditMode;
        if (isEditMode) {
            toggleEditBtn.textContent = "РЕЖИМ РЕДАКТОРА: ВКЛ";
            toggleEditBtn.classList.add('active');
            exportBtn.style.display = "inline-block";
            if (tooltip) tooltip.style.display = 'none';
            
            if (panzoom) {
                panzoom.setOptions({ disablePan: true }); // Блокируем карту, чтобы ставить точки без сдвигов
            }
        } else {
            toggleEditBtn.textContent = "РЕЖИМ РЕДАКТОРА: ВЫКЛ";
            toggleEditBtn.classList.remove('active');
            exportBtn.style.display = "none";
            modal.style.display = 'none';
            
            if (panzoom) {
                panzoom.setOptions({ disablePan: false }); // Разблокируем карту обратно
            }
        }
    });

    // Клик по карте в режиме редактирования (расчет точных координат через матрицу трансформации)
    if (panzoomElem) {
        panzoomElem.addEventListener('click', (e) => {
            if (!isEditMode) return;

            const activeLayer = document.querySelector('.map-layer.active');
            if (!activeLayer) return;
            const svg = activeLayer.querySelector('svg');
            if (!svg) return;

            // Если кликнули по уже существующему маркеру, форму создания новой точки не открываем
            if (e.target.closest('.key')) return; 

            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            
            // Преобразование экранных координат клика в координаты SVG с учетом масштаба Panzoom
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

            // Сохраняем координаты в память модального окна и открываем его
            modal.style.display = 'block';
            modal.dataset.x = svgP.x;
            modal.dataset.y = svgP.y;
        });
    }

    function resetModalFields() {
        document.getElementById('m-title').value = '';
        document.getElementById('m-desc').value = '';
        document.getElementById('m-image').value = '';
    }

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        resetModalFields();
    });

    // Добавление созданной точки в массив данных
    saveBtn.addEventListener('click', () => {
        const title = document.getElementById('m-title').value.trim();
        const desc = document.getElementById('m-desc').value.trim();
        const image = document.getElementById('m-image').value.trim();
        const category = document.getElementById('m-cat').value;

        if (!title) {
            alert("Введите название точки!");
            return;
        }

        const newMarker = {
            id: Date.now(),
            map: activeMapId, // Привязка к текущей активной карте
            category: category,
            x: Math.round(parseFloat(modal.dataset.x)),
            y: Math.round(parseFloat(modal.dataset.y)),
            title: title,
            desc: desc || "Описание отсутствует.",
            image: image || ""
        };

        markersData.push(newMarker);
        renderDynamicMarkers(); // Перерисовываем карту с новой точкой

        modal.style.display = 'none';
        resetModalFields();
    });

    // Скачивание сформированного файла JSON
    exportBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(markersData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "arena_breakout_markers.json";
        a.click();
        URL.revokeObjectURL(url);
    });

    // ==========================================
    // 6. УМНЫЕ ТУЛТИПЫ ДЛЯ ПК И СМАРТФОНОВ
    // ==========================================
    const tooltip = document.querySelector('.tooltip');

    function updateTooltipPosition(pageX, pageY) {
        if (!tooltip || tooltip.style.display !== 'block') return;
        
        if (infoBg && infoBg.classList.contains('active')) {
            tooltip.style.display = 'none';
            return;
        }

        let x = pageX + 15;
        let y = pageY + 15;
        
        const tooltipWidth = tooltip.offsetWidth;
        const tooltipHeight = tooltip.offsetHeight;
        
        if (x + tooltipWidth > window.innerWidth) {
            x = pageX - tooltipWidth - 15;
        }
        if (y + tooltipHeight > window.innerHeight) {
            y = pageY - tooltipHeight - 15;
        }
        
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    // Слежение за курсором мыши
    document.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e.pageX, e.pageY);
    });

    // Слежение за пальцем на сенсорных экранах
    document.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            updateTooltipPosition(e.touches[0].pageX, e.touches[0].pageY);
        }
    }, { passive: true });

    // Показ тултипов при наведении мыши или тапе пальцем
    if (panzoomElem) {
        panzoomElem.addEventListener('mouseover', function (e) {
            const key = e.target.closest('.key');
            if (!key || isEditMode) return;

            if (tooltip) {
                tooltip.textContent = key.getAttribute('data-title') || "Без названия";
                tooltip.style.display = 'block';
            }
        });

        panzoomElem.addEventListener('mouseout', function (e) {
            const key = e.target.closest('.key');
            if (key && tooltip) {
                tooltip.style.display = 'none';
            }
        });

        panzoomElem.addEventListener('touchstart', function (e) {
            const key = e.target.closest('.key');
            if (!key || isEditMode) return;

            if (tooltip) {
                tooltip.textContent = key.getAttribute('data-title') || "Без названия";
                tooltip.style.display = 'block';
                
                if (e.touches && e.touches[0]) {
                    updateTooltipPosition(e.touches[0].pageX, e.touches[0].pageY);
                }
            }
        }, { passive: true });

        // Скрываем тултипы при начале зума или перемещения карты
        panzoomElem.addEventListener('panzoomstart', () => {
            if (tooltip) tooltip.style.display = 'none';
        });
    }

    // Скрываем тултипы, если тапнули в пустое место экрана
    document.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.key') && tooltip) {
            tooltip.style.display = 'none';
        }
    }, { passive: true });

    // Запуск первичного сканирования JSON при загрузке страницы
    loadMarkers();
});
