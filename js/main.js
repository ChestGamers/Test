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
            excludeClass: 'key' // Чтобы клики по меткам не сбивали перетаскивание
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
        // Ищем слой для рендера только внутри активной карты
        const activeLayer = document.querySelector('.map-layer.active');
        if (!activeLayer) return;

        const dynamicLayer = activeLayer.querySelector('.dynamic-markers-layer');
        if (!dynamicLayer) return;

        // Полностью очищаем старые маркеры
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
            
            // Назначаем класс (базовый "key" + модификатор категории "box", "weapon", "extract", "spawn")
            let className = "key";
            if (marker.category && marker.category !== "loot") {
                className += ` ${marker.category}`;
            }

            circle.setAttribute("class", className);
            circle.setAttribute("cx", marker.x);
            circle.setAttribute("cy", marker.y);
            circle.setAttribute("r", "25"); // Размер круга-сейфа
            
            // Записываем данные для тултипов и модалок
            circle.setAttribute("data-title", marker.title);
            circle.setAttribute("data-description", marker.desc || "Описание отсутствует");
            circle.setAttribute("data-photo", marker.image || "");
            circle.setAttribute("data-id", marker.id);

            dynamicLayer.appendChild(circle);
        });
    }

    // Попытка автозагрузки файла JSON с сервера
    async function loadMarkers() {
        try {
            const response = await fetch('arena_breakout_markers.json');
            if (response.ok) {
                markersData = await response.json();
                console.log("Данные успешно подгружены из файла JSON.");
            }
        } catch (e) {
            console.log("Файл JSON пока пуст или отсутствует на сервере. Начни добавлять точки!");
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

        // Рендерим точки для новой активной карты
        renderDynamicMarkers();

        if (panzoom) {
            setTimeout(() => {
                panzoom.reset();
            }, 50);
        }
    }

    // Клик по обычным кнопкам карт
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            filterButtons.forEach(b => b.classList.remove('active'));
            if (armorySelect) armorySelect.value = ""; 

            this.classList.add('active');
            setActiveMap(this.getAttribute('data-map'));
        });
    });

    // Изменение подэтажей Арсенала
    if (armorySelect) {
        armorySelect.addEventListener('change', function () {
            if (this.value) {
                filterButtons.forEach(b => b.classList.remove('active'));
                setActiveMap(this.value);
            }
        });
    }

    // Фильтр категорий лута (Все, только сейфы, кейсы и т.д.)
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

    // Открытие инфо-попапа (Event Delegation, чтобы работало и для созданных кругов)
    if (panzoomElem) {
        panzoomElem.addEventListener('click', function (e) {
            const key = e.target.closest('.key');
            if (!key || isEditMode) return; // В режиме редактирования клик ставит точку, попап не открываем
            
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

    if (infoClose) {
        infoClose.addEventListener('click', () => {
            if (infoBg) infoBg.classList.remove('active');
        });
    }

    if (infoBg) {
        infoBg.addEventListener('click', function (e) {
            if (e.target === this) {
                this.classList.remove('active');
            }
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

    // Переключение режима с проверкой пароля
    toggleEditBtn.addEventListener('click', () => {
        if (!isEditMode) {
            // Если режим выключен, запрашиваем пароль для включения
            const password = prompt("Введите пароль для редактирования карты:");
            
            if (password !== "admin123") { // Замени "admin123" на свой секретный пароль
                alert("Неверный пароль!");
                return;
            }
        }

        // Если пароль верный или мы просто выключаем режим
        isEditMode = !isEditMode;
        if (isEditMode) {
            toggleEditBtn.textContent = "РЕЖИМ РЕДАКТОРА: ВКЛ";
            toggleEditBtn.classList.add('active');
            exportBtn.style.display = "inline-block";
            if (tooltip) tooltip.style.display = 'none';
            
            if (panzoom) {
                panzoom.setOptions({ disablePan: true });
            }
        } else {
            toggleEditBtn.textContent = "РЕЖИМ РЕДАКТОРА: ВЫКЛ";
            toggleEditBtn.classList.remove('active');
            exportBtn.style.display = "none";
            modal.style.display = 'none';
            
            if (panzoom) {
                panzoom.setOptions({ disablePan: false });
            }
        }
    });

    // Клик по карте в режиме редактирования (вычисляем точные координаты)
    if (panzoomElem) {
        panzoomElem.addEventListener('click', (e) => {
            if (!isEditMode) return;

            // Находим активный SVG
            const activeLayer = document.querySelector('.map-layer.active');
            if (!activeLayer) return;
            const svg = activeLayer.querySelector('svg');
            if (!svg) return;

            // Предотвращаем открытие модалок лута при установке точки
            if (e.target.closest('.key')) return; 

            const pt = svg.createSVGPoint();
            pt.x = e.clientX;
            pt.y = e.clientY;
            
            // Гениальная формула: рассчитывает координаты SVG с учетом текущего зума
            const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

            // Записываем координаты в память модалки и открываем форму ввода
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

    // Сохранение новой точки в массив
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
            map: activeMapId, // Привязываем точку к текущей карте (farm, valley, etc.)
            category: category,
            x: Math.round(parseFloat(modal.dataset.x)),
            y: Math.round(parseFloat(modal.dataset.y)),
            title: title,
            desc: desc || "Описание отсутствует.",
            image: image || ""
        };

        markersData.push(newMarker);
        renderDynamicMarkers();

        modal.style.display = 'none';
        resetModalFields();
    });

    // Скачивание JSON-файла
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
    // 6. УМНЫЕ ТУЛТИПЫ ДЛЯ ПК И ТЕЛЕФОНОВ
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

    // Движение мыши (ПК)
    document.addEventListener('mousemove', (e) => {
        updateTooltipPosition(e.pageX, e.pageY);
    });

    // Движение пальца (Мобилки)
    document.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches[0]) {
            updateTooltipPosition(e.touches[0].pageX, e.touches[0].pageY);
        }
    }, { passive: true });

    // Использование делегирования событий для тултипов на ПК и смартфонах
    if (panzoomElem) {
        // Мышка навелась на метку
        panzoomElem.addEventListener('mouseover', function (e) {
            const key = e.target.closest('.key');
            if (!key || isEditMode) return;

            if (tooltip) {
                tooltip.textContent = key.getAttribute('data-title') || "Без названия";
                tooltip.style.display = 'block';
            }
        });

        // Мышка ушла с метки
        panzoomElem.addEventListener('mouseout', function (e) {
            const key = e.target.closest('.key');
            if (key && tooltip) {
                tooltip.style.display = 'none';
            }
        });

        // Тап пальцем по метке (Смартфоны)
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
    }

    // Скрывать тултип при зуме / движении карты
    if (panzoomElem) {
        panzoomElem.addEventListener('panzoomstart', () => {
            if (tooltip) tooltip.style.display = 'none';
        });
    }

    // Скрывать тултип, если тапнули в пустое место
    document.addEventListener('touchstart', (e) => {
        if (!e.target.closest('.key') && tooltip) {
            tooltip.style.display = 'none';
        }
    }, { passive: true });

    // Запуск автоподгрузки JSON
    loadMarkers();
});