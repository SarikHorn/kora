/**
 * សៀវភៅកុំព្យូទ័រសម្រាប់ព័ន្ធកិច្ច (Computer for Ministry)
 * Modern Interactive Web View Application
 * Offline-Ready Single Page Architecture
 */

(function () {
  'use strict';

  // Global App State - Default to 'home' on initial load
  const state = {
    data: null,
    activeModuleId: 'home',
    activeNodeId: 'home', // Default open: Home / Welcome Overview Page
    activeFilter: 'all',
    searchQuery: '',
    fontSizeLevel: parseInt(localStorage.getItem('agy_fontsize') || '1', 10), // 0: 14px, 1: 16px, 2: 18px, 3: 20px
    theme: localStorage.getItem('agy_theme') || 'light',
    flattenedTopics: [] // Linear array of all tools for Next/Prev navigation
  };

  const fontSizes = [14, 16, 18, 20]; // in px

  // DOM Elements Cache
  const el = {
    treeContainer: document.getElementById('sidebar-tree'),
    viewerContent: document.getElementById('viewer-content'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    searchInput: document.getElementById('search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    filterChips: document.querySelectorAll('.chip-btn'),
    filterChipsRow: document.getElementById('filter-chips-row'),
    chipScrollLeft: document.getElementById('chip-scroll-left'),
    chipScrollRight: document.getElementById('chip-scroll-right'),
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    fontDecBtn: document.getElementById('font-dec-btn'),
    fontResetBtn: document.getElementById('font-reset-btn'),
    fontIncBtn: document.getElementById('font-inc-btn'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.getElementById('sidebar'),
    sidebarBackdrop: document.getElementById('sidebar-backdrop'),
    sidebarResizer: document.getElementById('sidebar-resizer'),
    appContainer: document.getElementById('app-container'),
    homeNavBtn: document.getElementById('home-nav-btn'),
    lightbox: document.getElementById('lightbox-modal'),
    lightboxImg: document.getElementById('lightbox-img'),
    lightboxClose: document.getElementById('lightbox-close'),
    toast: document.getElementById('toast-notice'),
    toastMsg: document.getElementById('toast-msg'),
    expandAllBtn: document.getElementById('expand-all-btn'),
    printBtn: document.getElementById('print-btn'),
    mobileMoreBtn: document.getElementById('mobile-more-btn'),
    mobileMorePopover: document.getElementById('header-more-popover'),
    mFontDecBtn: document.getElementById('m-font-dec-btn'),
    mFontResetBtn: document.getElementById('m-font-reset-btn'),
    mFontIncBtn: document.getElementById('m-font-inc-btn'),
    mExpandAllBtn: document.getElementById('m-expand-all-btn'),
    mExpandText: document.getElementById('m-expand-text')
  };

  // Initialize Application
  function init() {
    if (!window.BOOK_DATA) {
      console.error('BOOK_DATA not found. Please ensure assets/book_data.js is loaded.');
      if (el.viewerContent) {
        el.viewerContent.innerHTML = '<div class="feature-card"><p style="color:red;">Error: មិនអាចទាញយកទិន្នន័យមេរៀនបានទេ។ សូមពិនិត្យមើលឯកសារ assets/book_data.js</p></div>';
      }
      return;
    }

    state.data = window.BOOK_DATA;

    // Build flattened list for Next / Prev navigation
    buildFlattenedTopics();

    // Apply saved theme & font size
    setTheme(state.theme);
    applyFontSize(false); // don't toast on initial load

    // Initialize Column Resizer
    initColumnResizer();

    // Initialize Filter Chips Horizontal Scroll
    initFilterChipsScroll();

    // Render navigation tree
    renderTree();

    // Bind event listeners
    bindEvents();

    // Render default view (Home / Welcome Overview Page)
    navigateTo(state.activeNodeId);
  }

  // Column Resizer: Drag to resize Column 1 (Sidebar)
  function initColumnResizer() {
    if (!el.sidebarResizer || !el.sidebar || !el.appContainer) return;

    // Restore saved width from localStorage
    const savedWidth = localStorage.getItem('agy_sidebar_width');
    if (savedWidth) {
      const w = parseInt(savedWidth, 10);
      if (w >= 260 && w <= 700) {
        el.sidebar.style.width = w + 'px';
      }
    }

    let isDragging = false;

    el.sidebarResizer.addEventListener('mousedown', (e) => {
      isDragging = true;
      el.sidebarResizer.classList.add('is-dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const containerLeft = el.appContainer.getBoundingClientRect().left;
      let newWidth = e.clientX - containerLeft;

      const minWidth = 260;
      const maxWidth = Math.min(650, window.innerWidth * 0.65);

      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;

      el.sidebar.style.width = newWidth + 'px';
      localStorage.setItem('agy_sidebar_width', newWidth.toString());
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        el.sidebarResizer.classList.remove('is-dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });

    // Double-click to reset default width
    el.sidebarResizer.addEventListener('dblclick', () => {
      el.sidebar.style.width = '370px';
      localStorage.setItem('agy_sidebar_width', '370');
      showToast('បានកំណត់ទំហំ Column មកដើមវិញ (370px)');
    });
  }

  // Filter Chips: Enable mousewheel and arrow button horizontal scrolling
  function initFilterChipsScroll() {
    if (el.filterChipsRow) {
      // Mousewheel horizontal scroll
      el.filterChipsRow.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.filterChipsRow.scrollLeft += e.deltaY * 0.85;
        }
      }, { passive: false });
    }

    // Left arrow click
    if (el.chipScrollLeft && el.filterChipsRow) {
      el.chipScrollLeft.addEventListener('click', () => {
        el.filterChipsRow.scrollBy({ left: -140, behavior: 'smooth' });
      });
    }

    // Right arrow click
    if (el.chipScrollRight && el.filterChipsRow) {
      el.chipScrollRight.addEventListener('click', () => {
        el.filterChipsRow.scrollBy({ left: 140, behavior: 'smooth' });
      });
    }
  }

  // Font Size Scaler: Updates root html font size so all rem units scale
  function applyFontSize(showNotice = true) {
    const sizePx = fontSizes[state.fontSizeLevel];

    // Set root html font size
    document.documentElement.style.fontSize = sizePx + 'px';
    document.documentElement.style.setProperty('--font-base', sizePx + 'px');
    localStorage.setItem('agy_fontsize', state.fontSizeLevel.toString());

    // Update active state on buttons
    if (el.fontDecBtn) el.fontDecBtn.classList.toggle('active', state.fontSizeLevel === 0);
    if (el.fontResetBtn) el.fontResetBtn.classList.toggle('active', state.fontSizeLevel === 1);
    if (el.fontIncBtn) el.fontIncBtn.classList.toggle('active', state.fontSizeLevel >= 2);

    // Update active state on mobile popover buttons
    if (el.mFontDecBtn) el.mFontDecBtn.classList.toggle('active', state.fontSizeLevel === 0);
    if (el.mFontResetBtn) el.mFontResetBtn.classList.toggle('active', state.fontSizeLevel === 1);
    if (el.mFontIncBtn) el.mFontIncBtn.classList.toggle('active', state.fontSizeLevel >= 2);

    if (showNotice) {
      const labels = ['តូច (14px)', 'ធម្មតា (16px)', 'ធំ (18px)', 'ធំខ្លាំង (20px)'];
      showToast(`ទំហំអក្សរ៖ ${labels[state.fontSizeLevel]}`);
    }
  }

  // Flatten all navigable topics across all modules
  function buildFlattenedTopics() {
    state.flattenedTopics = [];

    // Module 0: Intro
    const introMod = state.data.modules.find(m => m.id === 'intro');
    if (introMod) {
      introMod.chapters.forEach(ch => {
        ch.sections.forEach(sec => {
          state.flattenedTopics.push({
            id: sec.id,
            type: 'section',
            title: sec.title,
            modId: 'intro',
            modTitle: introMod.title
          });
        });
      });
    }

    // Modules 1, 2, 3: Word, PowerPoint, Excel
    ['word', 'powerpoint', 'excel'].forEach(modId => {
      const mod = state.data.modules.find(m => m.id === modId);
      if (!mod) return;

      mod.chapters.forEach(ch => {
        ch.sections.forEach(sec => {
          if (sec.tools && sec.tools.length > 0) {
            sec.tools.forEach(tool => {
              state.flattenedTopics.push({
                id: tool.id,
                type: 'tool',
                title: tool.title,
                modId: mod.id,
                modTitle: mod.title
              });
            });
          } else {
            state.flattenedTopics.push({
              id: sec.id,
              type: 'section',
              title: sec.title,
              modId: mod.id,
              modTitle: mod.title
            });
          }
        });
      });
    });
  }

  // Render Sidebar Tree Navigation
  function renderTree() {
    if (!el.treeContainer) return;
    el.treeContainer.innerHTML = '';

    const filter = state.activeFilter;
    const query = state.searchQuery.toLowerCase().trim();

    state.data.modules.forEach(mod => {
      if (filter !== 'all' && filter !== 'shortcuts' && filter !== 'exercises' && filter !== mod.id) {
        return;
      }

      // Filter chapters based on search query, shortcuts, or exercises
      const modChapters = mod.chapters.filter(ch => {
        if (!query && filter !== 'shortcuts' && filter !== 'exercises') return true;

        if (filter === 'shortcuts') {
          return ch.sections.some(s => s.tools && s.tools.some(t => t.shortcut));
        }

        if (filter === 'exercises') {
          return ch.sections.some(s => s.isExerciseSection || (s.tools && s.tools.some(t => t.isExercise)));
        }

        const matchCh = ch.title.toLowerCase().includes(query) || (ch.tabName && ch.tabName.toLowerCase().includes(query));
        if (matchCh) return true;

        return ch.sections.some(sec => {
          const matchSec = sec.title.toLowerCase().includes(query);
          if (matchSec) return true;
          return sec.tools && sec.tools.some(t => {
            return t.title.toLowerCase().includes(query) ||
              (t.definition && t.definition.toLowerCase().includes(query)) ||
              (t.procedure && t.procedure.toLowerCase().includes(query)) ||
              (t.shortcut && t.shortcut.toLowerCase().includes(query));
          });
        });
      });

      if (modChapters.length === 0 && (query || filter === 'shortcuts' || filter === 'exercises')) {
        return;
      }

      let totalModTools = 0;
      mod.chapters.forEach(c => c.sections.forEach(s => totalModTools += (s.tools ? s.tools.length : 0)));

      // Module Wrapper
      const modDiv = document.createElement('div');
      modDiv.className = `tree-module mod-${mod.id}`;
      modDiv.id = `mod-node-${mod.id}`;

      // Module Header (Parent Level 1)
      const modHeader = document.createElement('div');
      // Keep expanded by default if intro, shortcuts, exercises or matches search
      const isExpanded = query || filter === 'shortcuts' || filter === 'exercises';
      modHeader.className = `module-header ${isExpanded ? 'expanded' : ''}`;
      modHeader.innerHTML = `
        <div class="module-title-wrap">
          <div class="module-icon-badge ${mod.id}">
            ${mod.logo ? `<img src="${mod.logo}" alt="${mod.shortTitle}" />` : (mod.id === 'intro' ? '📖' : '📁')}
          </div>
          <div class="module-name-col">
            <span class="module-name">${mod.title}</span>
            <span class="module-term">${mod.subtitle}</span>
          </div>
        </div>
        <div class="module-meta-wrap">
          <span class="count-badge">${totalModTools > 0 ? `${totalModTools} ឧបករណ៍` : `${mod.chapters.length} ជំពូក`}</span>
          <span class="chevron-icon">▶</span>
        </div>
      `;

      // Chapter List Container
      const chapterList = document.createElement('div');
      chapterList.className = `chapter-list ${isExpanded ? 'open' : ''}`;

      // Click on Module Header: toggle open and navigate to module overview
      modHeader.addEventListener('click', (e) => {
        modHeader.classList.toggle('expanded');
        chapterList.classList.toggle('open');
        navigateTo(mod.id);
      });

      // Render Chapters (Child Level 2)
      modChapters.forEach(ch => {
        const chDiv = document.createElement('div');
        chDiv.className = 'chapter-item';
        chDiv.id = `node-${ch.id}`;

        let totalChTools = 0;
        ch.sections.forEach(s => totalChTools += (s.tools ? s.tools.length : 0));

        // Chapter Header
        const chHeader = document.createElement('div');
        chHeader.className = `chapter-header ${state.activeNodeId === ch.id ? `active active-${mod.id}` : ''}`;
        chHeader.innerHTML = `
          <div class="chapter-title-wrap" title="${ch.title}">
            <span class="chevron-icon ch-chevron">▶</span>
            <span class="chapter-title-text">${ch.title}</span>
          </div>
          ${ch.tabName ? `<span class="tab-badge">${ch.tabName}</span>` : (totalChTools > 0 ? `<span class="count-badge">${totalChTools}</span>` : '')}
        `;

        // Section List Container
        const secList = document.createElement('div');
        secList.className = 'section-list';

        if (query || filter === 'shortcuts' || filter === 'exercises' || isNodeDescendant(ch, state.activeNodeId)) {
          secList.classList.add('open');
          chHeader.classList.add('expanded');
        }

        chHeader.addEventListener('click', (e) => {
          e.stopPropagation();
          chHeader.classList.toggle('expanded');
          secList.classList.toggle('open');
          navigateTo(ch.id);
        });

        // Render Sections (Child Level 3)
        ch.sections.forEach(sec => {
          if (filter === 'shortcuts' && (!sec.tools || !sec.tools.some(t => t.shortcut))) {
            return;
          }
          if (filter === 'exercises' && !sec.isExerciseSection && (!sec.tools || !sec.tools.some(t => t.isExercise))) {
            return;
          }

          const secDiv = document.createElement('div');
          secDiv.className = 'section-item';
          secDiv.id = `node-${sec.id}`;

          const hasTools = sec.tools && sec.tools.length > 0;

          // Section Header
          const secHeader = document.createElement('div');
          secHeader.className = `section-header ${state.activeNodeId === sec.id ? 'active' : ''}`;
          secHeader.innerHTML = `
            <div class="section-title-wrap" title="${sec.title}">
              ${hasTools ? '<span class="chevron-icon sec-chevron">▶</span>' : '<span class="tool-dot"></span>'}
              <span class="section-title-text">${sec.title}</span>
            </div>
            ${hasTools ? `<span class="count-badge">${sec.tools.length}</span>` : ''}
          `;

          // Tool List Container
          const toolList = document.createElement('div');
          toolList.className = 'tool-list';

          if (query || filter === 'shortcuts' || filter === 'exercises' || (hasTools && sec.tools.some(t => t.id === state.activeNodeId))) {
            toolList.classList.add('open');
            secHeader.classList.add('expanded');
          }

          secHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hasTools) {
              secHeader.classList.toggle('expanded');
              toolList.classList.toggle('open');
            }
            navigateTo(sec.id);
          });

          // Render Tools (Child Level 4)
          if (hasTools) {
            sec.tools.forEach(tool => {
              if (filter === 'shortcuts' && !tool.shortcut) {
                return;
              }
              if (filter === 'exercises' && !tool.isExercise) {
                return;
              }

              if (query) {
                const matchTitle = tool.title.toLowerCase().includes(query);
                const matchDef = tool.definition && tool.definition.toLowerCase().includes(query);
                const matchProc = tool.procedure && tool.procedure.toLowerCase().includes(query);
                const matchSc = tool.shortcut && tool.shortcut.toLowerCase().includes(query);
                if (!matchTitle && !matchDef && !matchProc && !matchSc) {
                  return;
                }
              }

              const toolItem = document.createElement('div');
              toolItem.className = `tool-item ${state.activeNodeId === tool.id ? `active active-${mod.id}` : ''}`;
              toolItem.id = `node-${tool.id}`;
              toolItem.setAttribute('data-id', tool.id);

              toolItem.innerHTML = `
                <div class="tool-title-wrap" title="${tool.title}">
                  <span class="tool-dot ${tool.isExercise ? 'exercise-dot' : ''}"></span>
                  <span class="tool-title-text">${tool.title}</span>
                </div>
                ${tool.shortcut ? `<span class="badge-sc">${formatShortcutBadge(tool.shortcut)}</span>` : ''}
                ${tool.isExercise ? `<span class="tree-exercise-badge">កិច្ចការ</span>` : ''}
              `;

              toolItem.addEventListener('click', (e) => {
                e.stopPropagation();
                navigateTo(tool.id);
                if (window.innerWidth <= 900) {
                  closeMobileSidebar();
                }
              });

              toolList.appendChild(toolItem);
            });
          }

          secDiv.appendChild(secHeader);
          if (hasTools) {
            secDiv.appendChild(toolList);
          }
          secList.appendChild(secDiv);
        });

        chDiv.appendChild(chHeader);
        chDiv.appendChild(secList);
        chapterList.appendChild(chDiv);
      });

      modDiv.appendChild(modHeader);
      modDiv.appendChild(chapterList);
      el.treeContainer.appendChild(modDiv);
    });

    if (el.treeContainer.children.length === 0) {
      el.treeContainer.innerHTML = `
        <div style="padding: 30px 16px; text-align: center; color: var(--text-muted);">
          <p style="font-size: 1.5rem; margin-bottom: 8px;">🔍</p>
          <p>រកមិនឃើញមេរៀនដែលត្រូវនឹង "<strong>${htmlEscape(query)}</strong>" ទេ</p>
          <p style="font-size: 0.78rem; margin-top: 6px;">សូមសាកល្បងពាក្យគន្លឹះផ្សេងទៀត</p>
        </div>
      `;
    }
  }

  function isNodeDescendant(chapter, targetId) {
    if (chapter.id === targetId) return true;
    for (const sec of chapter.sections) {
      if (sec.id === targetId) return true;
      if (sec.tools && sec.tools.some(t => t.id === targetId)) return true;
    }
    return false;
  }

  function findNode(id) {
    if (id === 'home') {
      return { type: 'home', id: 'home' };
    }
    for (const mod of state.data.modules) {
      if (mod.id === id) return { type: 'module', data: mod, module: mod };
      for (const ch of mod.chapters) {
        if (ch.id === id) return { type: 'chapter', data: ch, module: mod, chapter: ch };
        for (const sec of ch.sections) {
          if (sec.id === id) return { type: 'section', data: sec, module: mod, chapter: ch, section: sec };
          if (sec.tools) {
            for (const tool of sec.tools) {
              if (tool.id === id) return { type: 'tool', data: tool, module: mod, chapter: ch, section: sec, tool: tool };
            }
          }
        }
      }
    }
    return null;
  }

  function navigateTo(id) {
    const node = findNode(id);
    if (!node) return;

    state.activeNodeId = id;

    // Toggle active state on home button
    if (el.homeNavBtn) {
      el.homeNavBtn.classList.toggle('active', id === 'home');
    }

    if (id === 'home') {
      state.activeModuleId = 'home';
      updateActiveSidebarItem('home', 'intro');
      renderBreadcrumbs({ type: 'home' });
      renderHomeContent();
    } else {
      state.activeModuleId = node.module.id;
      updateActiveSidebarItem(id, node.module.id);
      renderBreadcrumbs(node);
      renderContent(node);
    }

    const viewer = document.getElementById('main-viewer');
    if (viewer) viewer.scrollTop = 0;
  }

  function updateActiveSidebarItem(id, modId) {
    const activeElements = document.querySelectorAll('.tool-item.active, .chapter-header.active, .section-header.active');
    activeElements.forEach(item => {
      item.classList.remove('active', 'active-word', 'active-ppt', 'active-excel');
    });

    if (id === 'home') return;

    const targetNode = document.getElementById(`node-${id}`);
    if (targetNode) {
      const activeEl = targetNode.classList.contains('tool-item') ? targetNode : targetNode.querySelector('.chapter-header, .section-header') || targetNode;
      activeEl.classList.add('active', `active-${modId}`);

      let parent = targetNode.parentElement;
      while (parent && parent !== el.treeContainer) {
        if (parent.classList.contains('chapter-list') || parent.classList.contains('section-list') || parent.classList.contains('tool-list')) {
          parent.classList.add('open');
          const header = parent.previousElementSibling;
          if (header) header.classList.add('expanded');
        }
        parent = parent.parentElement;
      }

      targetNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function renderBreadcrumbs(node) {
    if (!el.breadcrumbs) return;

    if (node.type === 'home') {
      el.breadcrumbs.innerHTML = `
        <span class="breadcrumb-item" onclick="window.appNavigateTo('home')">🏠 ទំព័រដើម</span>
        <span class="breadcrumb-sep">›</span>
        <span class="breadcrumb-current">ព័ត៌មានសៀវភៅ & អ្នករៀបរៀង</span>
      `;
      return;
    }

    const parts = [];
    parts.push({ title: '🏠 ទំព័រដើម', id: 'home' });
    parts.push({ title: node.module.title, id: node.module.id });

    if (node.chapter) {
      parts.push({ title: node.chapter.shortTitle || node.chapter.title, id: node.chapter.id });
    }
    if (node.section) {
      parts.push({ title: node.section.title, id: node.section.id });
    }
    if (node.tool) {
      parts.push({ title: node.tool.title, id: node.tool.id, isCurrent: true });
    } else if (node.type === 'section') {
      parts[parts.length - 1].isCurrent = true;
    } else if (node.type === 'chapter') {
      parts[parts.length - 1].isCurrent = true;
    }

    el.breadcrumbs.innerHTML = parts.map((p) => {
      if (p.isCurrent) {
        return `<span class="breadcrumb-current">${p.title}</span>`;
      }
      return `
        <span class="breadcrumb-item" onclick="window.appNavigateTo('${p.id}')">${p.title}</span>
        <span class="breadcrumb-sep">›</span>
      `;
    }).join('');
  }

  function renderContent(node) {
    if (!el.viewerContent) return;

    if (node.type === 'tool') {
      renderToolContent(node);
    } else if (node.type === 'section') {
      renderSectionContent(node);
    } else if (node.type === 'chapter') {
      renderChapterContent(node);
    } else if (node.type === 'module') {
      renderModuleContent(node);
    }
  }

  // ==========================================================================
  // Render Welcome / Home Page (Default Open)
  // ==========================================================================
  function renderHomeContent() {
    if (!el.viewerContent) return;

    const stats = state.data.stats || { modules: 4, chapters: 31, sections: 107, tools: 231 };

    el.viewerContent.innerHTML = `
      <!-- Hero Top Banner -->
      <div class="home-hero-wrap">
        <div class="home-badge-row">
          <span class="institution-badge">🎓 សាលាទេវវិទ្យា CPTIs (CPTIs Theological Seminary)</span>
          <span class="church-badge">⛪ ពួកជំនុំបេសកកម្មនៃក្ដីសង្ឃឹម (Hope Mission Church)</span>
        </div>
        <h1 class="home-main-title">សៀវភៅកុំព្យូទ័រសម្រាប់ព័ន្ធកិច្ចពួកជំនុំ</h1>
        <div class="home-main-subtitle">
          មគ្គុទ្ទេសក៍ជាក់ស្ដែងនៃការប្រើប្រាស់ <strong>Microsoft Word, PowerPoint & Excel</strong> សម្រាប់រដ្ឋបាលពួកជំនុំ ការផលិតស្លាយថ្វាយបង្គំ និងការគ្រប់គ្រងទិន្នន័យហិរញ្ញវត្ថុ
        </div>
      </div>

      <!-- Scripture Quote Card -->
      <div class="scripture-card">
        <div class="scripture-quote">
          «ត្រូវ​តែ​ធ្វើ​ការ​ទាំង​អស់​តាម​បែប​គួរ​សម ហើយ​ដោយ​លំដាប់លំដោយ​ផង»
        </div>
        <div class="scripture-ref">— ១ កូរិនថូស ១៤:៤០ (1 Corinthians 14:40)</div>
      </div>

      <!-- Author & Teacher Profile Card -->
      <div class="author-profile-card">
        <div class="author-photo-wrap">
          <img src="assets/images/pc_profile.png" class="author-photo-img" alt="គ្រូគង្វាល សារិក ហោន" onclick="openLightbox('assets/images/pc_profile.png')" style="cursor: zoom-in;" title="ចុចដើម្បីពង្រីកធំ" />
        </div>
        <div class="author-details-col">
          <div class="author-name-title">
            <span>គ្រូគង្វាល សារិក ហោន</span>
            <span class="author-en-name">(Pastor SARIK HORN)</span>
          </div>
          <div class="author-meta-row">
            <span class="author-meta-item">🏫 <strong>ស្ថាប័ន៖</strong> សាលាទេវវិទ្យា CPTIs</span>
            <span class="author-meta-item">⛪ <strong>ពួកជំនុំ៖</strong> ពួកជំនុំបេសកកម្មនៃក្ដីសង្ឃឹម</span>
            <span class="author-meta-item">📖 <strong>តួនាទី៖</strong> គ្រូគង្វាល & សាស្ត្រាចារ្យកុំព្យូទ័រ</span>
          </div>
          <p class="author-bio-text">
            សៀវភៅសិក្សានេះ ត្រូវបានចងក្រងឡើងយ៉ាងផ្ចិតផ្ចង់ជាពិសេស សម្រាប់និស្សិតសាលាទេវវិទ្យា CPTIs, គ្រូគង្វាល, ថ្នាក់ដឹកនាំ និងអ្នកបម្រើព្រះគ្រប់ផ្នែកក្នុងពួកជំនុំ។ នៅក្នុងយុគសម័យឌីជីថលនេះ បច្ចេកវិទ្យាកុំព្យូទ័រលែងជាវិជ្ជាជីវៈដាច់ដោយឡែករបស់ពិភពលោកទៀតហើយ ប៉ុន្តែវាគឺជា «ប៊ិច និងក្រដាសសម័យទំនើប» ដែលព្រះទ្រង់ប្រទានឱ្យយើង ដើម្បីបម្រើកិច្ចការព្រះរាជ្យទ្រង់ឱ្យមានរបៀបរៀបរយ សោភ័ណភាព និងប្រសិទ្ធភាពខ្ពស់បំផុត។
          </p>
          <div style="margin-top: 14px; display: flex; gap: 10px; flex-wrap: wrap;">
            <a href="materials.html" class="btn-github-pill" title="បើកមជ្ឈមណ្ឌលឯកសារដើម្បីទាញយកឯកសារអនុវត្តន៍ និងកិច្ចការផ្ទះ (kora)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                <polyline points="12 11 12 17"></polyline>
                <polyline points="9 14 12 17 15 14"></polyline>
              </svg>
              <span>📂 មជ្ឈមណ្ឌលឯកសារ & កិច្ចការ (Kora)</span>
            </a>

            <a href="Computer_for_Ministry_CPTIs.zip" download="Computer_for_Ministry_CPTIs.zip" class="btn-github-pill" style="border-color: rgba(16, 124, 65, 0.4); color: #107c41;" title="ទាញយកកញ្ចប់សៀវភៅទាំងមូលសម្រាប់រៀន Offline លើកុំព្យូទ័រ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>💾 ទាញយកកញ្ចប់ Offline (ZIP 5MB)</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Quick Statistics Metric Bar -->
      <div class="home-stats-bar">
        <div class="stat-metric-card">
          <div class="stat-number">៤ វគ្គ</div>
          <div class="stat-label">កម្មវិធីសិក្សាពេញលេញ</div>
        </div>
        <div class="stat-metric-card">
          <div class="stat-number">${stats.chapters} ជំពូក</div>
          <div class="stat-label">មេរៀនតាមផ្ទាំងមុខងារ</div>
        </div>
        <div class="stat-metric-card">
          <div class="stat-number">${stats.sections} ផ្នែក</div>
          <div class="stat-label">ក្រុមមុខងារជាក់ស្ដែង</div>
        </div>
        <div class="stat-metric-card">
          <div class="stat-number">${stats.tools} ឧបករណ៍</div>
          <div class="stat-label">និយមន័យ & របៀបប្រើ</div>
        </div>
      </div>

      <!-- Core Modules Introduction & Ministry Benefits -->
      <div class="home-modules-section">
        <h2 class="section-lead-title">📚 កម្មវិធីសិក្សាទាំង ៣ និងអត្ថប្រយោជន៍សម្រាប់ព័ន្ធកិច្ច</h2>
        <p class="section-lead-desc">សូមជ្រើសរើសកម្មវិធីខាងក្រោម ដើម្បីចូលមើលខ្លឹមសារមេរៀន និយមន័យ និងជំហានអនុវត្តន៍ជាក់ស្ដែង៖</p>

        <div class="home-modules-grid">

          <!-- 1. Microsoft Word -->
          <div class="home-mod-card word">
            <div class="mod-card-top-row">
              <div class="mod-card-title-group">
                <div class="mod-card-icon">
                  <img src="assets/images/image4.png" alt="Microsoft Word" />
                </div>
                <div class="mod-card-headings">
                  <h3>Microsoft Word សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ</h3>
                  <div class="mod-card-term">Term 1 — ផ្ដោតលើរដ្ឋបាលពួកជំនុំ និងការរៀបចំឯកសារ</div>
                </div>
              </div>
              <span class="mod-card-stats-pill">១០ ជំពូក • ៤៦ ផ្នែក • ១២៥ ឧបករណ៍</span>
            </div>

            <p class="mod-card-desc">
              Microsoft Word គឺជាកម្មវិធីមូលដ្ឋានគ្រឹះដ៏សំខាន់បំផុត ក្នុងការគ្រប់គ្រងការងាររដ្ឋបាលប្រចាំថ្ងៃរបស់ពួកជំនុំ។ មេរៀននេះបង្រៀនឱ្យចេះកំណត់ទម្រង់ឯកសារ ការសរសេរគ្រោងមេរៀនអធិប្បាយ ការបង្កើតសារណាបទ និងឯកសារស្រាវជ្រាវគម្ពីរប្រកបដោយវិជ្ជាជីវៈ។
            </p>

            <div class="mod-benefits-box">
              <div class="mod-benefits-title">✨ អត្ថប្រយោជន៍គន្លឹះសម្រាប់ពួកជំនុំ៖</div>
              <ul class="mod-benefits-list">
                <li><span class="bullet-chk">✓</span> <strong>ការងាររដ្ឋបាល៖</strong> បង្កើតលិខិតបទដ្ឋានផ្លូវការ លិខិតអញ្ជើញ លិខិតបញ្ជាក់បុណ្យជ្រមុជទឹក និងកិច្ចសន្យាព្រះវិហារ។</li>
                <li><span class="bullet-chk">✓</span> <strong>គ្រោងមេរៀនអធិប្បាយ & ព្រឹត្តិបត្រ៖</strong> រៀបចំអត្ថបទអធិប្បាយ ខគម្ពីរ កាលវិភាគប្រចាំខែ និងព្រឹត្តិបត្រប្រចាំសប្ដាហ៍ (Church Bulletins)។</li>
                <li><span class="bullet-chk">✓</span> <strong>សារណាបទនិស្សិតគម្ពីរ៖</strong> បង្កើតមាតិកាស្វ័យប្រវត្តិ (Table of Contents), លេខយោងបាតទំព័រ (Footnotes), គន្ថនិទ្ទេស (Citations & Bibliography) ដោយមិនពិបាកធ្វើដោយដៃ។</li>
                <li><span class="bullet-chk">✓</span> <strong>ការរៀបចំក្បាលសៀវភៅ៖</strong> កំណត់រឹមក្រដាស Margins សម្រាប់ការកិបក្បាលសៀវភៅ បំបែកកណ្ឌទំព័រ Section Breaks និង Page Numbers។</li>
              </ul>
            </div>

            <div class="mod-card-action-row">
              <span style="font-size: 0.85rem; color: var(--text-muted);">ជំពូកទី ១ ដល់ ១០ រួមទាំងលំហាត់អនុវត្តន៍ និងតារាងពិន្ទុ</span>
              <button class="mod-cta-btn word" onclick="window.appNavigateTo('word')">
                <span>ចូលរៀន Microsoft Word</span>
                <span>➔</span>
              </button>
            </div>
          </div>

          <!-- 2. Microsoft PowerPoint -->
          <div class="home-mod-card ppt">
            <div class="mod-card-top-row">
              <div class="mod-card-title-group">
                <div class="mod-card-icon">
                  <img src="assets/images/image18.png" alt="Microsoft PowerPoint" />
                </div>
                <div class="mod-card-headings">
                  <h3>Microsoft PowerPoint សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ</h3>
                  <div class="mod-card-term">Term 2 — ផ្ដោតលើការផលិតស្លាយបទចម្រៀងថ្វាយបង្គំ និងការអធិប្បាយ</div>
                </div>
              </div>
              <span class="mod-card-stats-pill">៩ ជំពូក • ៣១ ផ្នែក • ៦១ ឧបករណ៍</span>
            </div>

            <p class="mod-card-desc">
              Microsoft PowerPoint គឺជាឧបករណ៍ចម្បងក្នុងការបង្ហាញមាតិកាសម្រាប់ការថ្វាយបង្គំ។ វគ្គនេះជួយឱ្យក្រុម Media និងគ្រូគង្វាលចេះផលិតស្លាយប្រកបដោយសោភ័ណភាព មិនចាំងភ្នែក ងាយស្រួលច្រៀងតាម និងជួយឱ្យក្រុមជំនុំងាយស្រួលយល់ព្រះបន្ទូល។
            </p>

            <div class="mod-benefits-box">
              <div class="mod-benefits-title">✨ អត្ថប្រយោជន៍គន្លឹះសម្រាប់ពួកជំនុំ៖</div>
              <ul class="mod-benefits-list">
                <li><span class="bullet-chk">✓</span> <strong>ស្លាយបទចម្រៀងថ្វាយបង្គំ៖</strong> យល់ដឹងពីគោលការណ៍កម្រិតពណ៌ Contrast, ពុម្ពអក្សរធំល្មម, Text Shadow, ការកាត់ឃ្លាបទចម្រៀងឱ្យត្រូវតាមចង្វាក់ភ្លេង។</li>
                <li><span class="bullet-chk">✓</span> <strong>ស្លាយអមសេចក្ដីអធិប្បាយ៖</strong> រៀបចំចំណុចសំខាន់ៗ ខគម្ពីរ រូបភាព និងដ្យាក្រាម SmartArt ជួយឱ្យអ្នកស្ដាប់ផ្ដោតអារម្មណ៍ និងចងចាំព្រះបន្ទូល។</li>
                <li><span class="bullet-chk">✓</span> <strong>ការបញ្ចាំងអេក្រង់ពីរ (Dual Screen & Presenter View)៖</strong> របៀបបញ្ចាំងស្លាយទៅកាន់ Projector ឬ TV ធំ ដោយអេក្រង់កុំព្យូទ័រនៅតែអាចមើលឃើញ Speaker Notes។</li>
                <li><span class="bullet-chk">✓</span> <strong>Church Template ជាមួយ Slide Master៖</strong> បង្កើតទម្រង់ស្លាយផ្លូវការរបស់ព្រះវិហារដែលមាន Logo និង Font ត្រឹមត្រូវ កំណត់តែម្ដង ប្រើបានរៀងរាល់សប្ដាហ៍។</li>
              </ul>
            </div>

            <div class="mod-card-action-row">
              <span style="font-size: 0.85rem; color: var(--text-muted);">ជំពូកទី ១ ដល់ ១០ រួមទាំងគម្រោងស្លាយថ្វាយបង្គំមួយចប់ពេញលេញ</span>
              <button class="mod-cta-btn ppt" onclick="window.appNavigateTo('powerpoint')">
                <span>ចូលរៀន Microsoft PowerPoint</span>
                <span>➔</span>
              </button>
            </div>
          </div>

          <!-- 3. Microsoft Excel -->
          <div class="home-mod-card excel">
            <div class="mod-card-top-row">
              <div class="mod-card-title-group">
                <div class="mod-card-icon">
                  <img src="assets/images/image25.png" alt="Microsoft Excel" />
                </div>
                <div class="mod-card-headings">
                  <h3>Microsoft Excel សម្រាប់ព័ន្ធកិច្ចពួកជំនុំ</h3>
                  <div class="mod-card-term">Term 3 — ផ្ដោតលើទិន្នន័យសមាជិកពួកជំនុំ និងគណនេយ្យហិរញ្ញវត្ថុ</div>
                </div>
              </div>
              <span class="mod-card-stats-pill">១០ ជំពូក • ២៥ ផ្នែក • ៤៥ ឧបករណ៍</span>
            </div>

            <p class="mod-card-desc">
              Microsoft Excel គឺជាកម្មវិធីតារាងការងារដ៏មានឥទ្ធិពល ក្នុងការរៀបចំទិន្នន័យសមាជិកពួកជំនុំឱ្យមានសុក្រឹតភាពខ្ពស់ និងការគ្រប់គ្រងប្រព័ន្ធគណនេយ្យហិរញ្ញវត្ថុព្រះវិហារប្រកបដោយតម្លាភាព និងភាពត្រឹមត្រូវខ្ពស់បំផុត។
            </p>

            <div class="mod-benefits-box">
              <div class="mod-benefits-title">✨ អត្ថប្រយោជន៍គន្លឹះសម្រាប់ពួកជំនុំ៖</div>
              <ul class="mod-benefits-list">
                <li><span class="bullet-chk">✓</span> <strong>ទិន្នន័យមេសមាជិក (Master Database)៖</strong> កត់ត្រាព័ត៌មានសមាជិក លេខសម្គាល់ Member ID និងគណនាអាយុស្វ័យប្រវត្តិតាមថ្ងៃកំណើត (DATEDIF, TODAY)។</li>
                <li><span class="bullet-chk">✓</span> <strong>គណនេយ្យតង្វាយ និងចំណាយ៖</strong> កត់ត្រាតង្វាយដប់ភាគមួយ និងចំណាយព្រះវិហារ ជាមួយរូបមន្តបូកសរុបមានលក្ខខណ្ឌ (SUMIF, SUMIFS, COUNTIF)។</li>
                <li><span class="bullet-chk">✓</span> <strong>ការស្រាវជ្រាវទិន្នន័យឆ្លាតវៃ៖</strong> ប្រើរូបមន្តស្វែងរកកម្រិតខ្ពស់ VLOOKUP, XLOOKUP, INDEX & MATCH គ្រាន់តែវាយ Member ID នឹងបង្ហាញព័ត៌មានសមាជិកភ្លាមៗ។</li>
                <li><span class="bullet-chk">✓</span> <strong>របាយការណ៍ស្វ័យប្រវត្តិតាម PivotTable & Charts៖</strong> បង្កើតរបាយការណ៍ហិរញ្ញវត្ថុសង្ខេបប្រចាំខែ និងក្រាហ្វិកស្ថិតិដោយចុចតែពីរបីឃ្លីក ងាយស្រួលរាយការណ៍ជូនក្រុមប្រឹក្សាពួកជំនុំ។</li>
              </ul>
            </div>

            <div class="mod-card-action-row">
              <span style="font-size: 0.85rem; color: var(--text-muted);">ជំពូកទី ១ ដល់ ១០ រួមទាំងគម្រោងបង្កើតប្រព័ន្ធគ្រប់គ្រងពួកជំនុំ ៤ Sheets</span>
              <button class="mod-cta-btn excel" onclick="window.appNavigateTo('excel')">
                <span>ចូលរៀន Microsoft Excel</span>
                <span>➔</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  // Render Tool View (Level 4)
  function renderToolContent(node) {
    const tool = node.tool;
    const mod = node.module;
    const ch = node.chapter;
    const sec = node.section;

    let mainTitle = tool.title;
    let subTitle = '';
    const titleMatch = tool.title.match(/^([^\(]+)(?:\(([^\)]+)\))?/);
    if (titleMatch) {
      mainTitle = titleMatch[1].trim();
      subTitle = titleMatch[2] ? titleMatch[2].trim() : '';
    }

    let stepsHtml = '';
    if (tool.steps && tool.steps.length > 0) {
      stepsHtml = `
        <div class="steps-chain">
          ${tool.steps.map((st, i) => `
            <div class="step-pill">
              <span class="step-num">${i + 1}</span>
              <span>${formatShortcutText(st)}</span>
            </div>
            ${i < tool.steps.length - 1 ? '<span class="step-arrow">➔</span>' : ''}
          `).join('')}
        </div>
      `;
    }

    const { prevTopic, nextTopic } = getAdjacentTopics(tool.id);

    el.viewerContent.innerHTML = `
      <!-- Hero Header -->
      <div class="hero-header">
        <div class="hero-badges-row">
          <span class="badge-tag ${mod.id}">${mod.shortTitle}</span>
          ${ch.tabName ? `<span class="badge-tag">${ch.tabName}</span>` : ''}
          <span class="badge-tag">${sec.title}</span>
          ${tool.shortcut ? `<span class="badge-tag sc-hero">⌨️ ${tool.shortcut}</span>` : ''}
        </div>
        <h1 class="hero-title">${mainTitle}</h1>
        ${subTitle ? `<div class="hero-subtitle">${subTitle}</div>` : ''}
      </div>

      <!-- Feature Cards Container -->
      <div class="cards-container">
        
        <!-- 1. Definition Card (📌 និយមន័យ) -->
        ${tool.definition ? `
          <div class="feature-card card-def">
            <div class="card-header-row">
              <div class="card-title-group">
                <span class="card-icon-pill">📌</span>
                <h3 class="card-title">និយមន័យ (Definition)</h3>
              </div>
              <button class="card-copy-btn" onclick="window.appCopyText('${escapeJsString(tool.definition)}')">
                <span>📋</span> ចម្លង
              </button>
            </div>
            <div class="card-body">
              <p>${tool.definition}</p>
            </div>
          </div>
        ` : ''}

        <!-- 2. Procedure Card (🛠️ របៀបអនុវត្ត) -->
        ${tool.procedure ? `
          <div class="feature-card card-proc">
            <div class="card-header-row">
              <div class="card-title-group">
                <span class="card-icon-pill">🛠️</span>
                <h3 class="card-title">របៀបអនុវត្ត (How to Use)</h3>
              </div>
              <button class="card-copy-btn" onclick="window.appCopyText('${escapeJsString(tool.procedure)}')">
                <span>📋</span> ចម្លងរបៀប
              </button>
            </div>
            <div class="card-body">
              <p style="margin-bottom: 8px;">${formatShortcutText(tool.procedure)}</p>
              ${stepsHtml}
            </div>
          </div>
        ` : ''}

        <!-- 3. Shortcut Card (⌨️ ផ្លូវកាត់ក្ដារចុច) -->
        ${tool.shortcut ? `
          <div class="feature-card card-shortcut">
            <div class="card-header-row">
              <div class="card-title-group">
                <span class="card-icon-pill">⌨️</span>
                <h3 class="card-title">ផ្លូវកាត់ក្ដារចុច (Keyboard Shortcut)</h3>
              </div>
              <button class="card-copy-btn" onclick="window.appCopyText('${escapeJsString(tool.shortcut)}')">
                <span>📋</span> ចម្លង Shortcut
              </button>
            </div>
            <div class="card-body">
              <div class="shortcuts-display-row">
                <div class="kbd-hero">${formatShortcutKeycaps(tool.shortcut)}</div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 4. Notes, Tips, Exercises & Media Card -->
        ${tool.html ? `
          <div class="feature-card card-notes">
            <div class="card-header-row">
              <div class="card-title-group">
                <span class="card-icon-pill">💡</span>
                <h3 class="card-title">ខ្លឹមសារលម្អិត & ការអនុវត្ត (Details & Examples)</h3>
              </div>
            </div>
            <div class="card-body rich-text">
              ${tool.html}
            </div>
          </div>
        ` : ''}

      </div>

      <!-- Bottom Topic Navigation -->
      <div class="viewer-pagination">
        ${prevTopic ? `
          <div class="nav-topic-btn" onclick="window.appNavigateTo('${prevTopic.id}')">
            <span class="nav-direction-label">⬅️ មេរៀនមុន</span>
            <span class="nav-topic-title">${prevTopic.title}</span>
          </div>
        ` : '<div></div>'}

        ${nextTopic ? `
          <div class="nav-topic-btn" style="text-align: right; align-items: flex-end;" onclick="window.appNavigateTo('${nextTopic.id}')">
            <span class="nav-direction-label">មេរៀនបន្ទាប់ ➡️</span>
            <span class="nav-topic-title">${nextTopic.title}</span>
          </div>
        ` : '<div></div>'}
      </div>
    `;
  }

  // Render Chapter View (Level 2)
  function renderChapterContent(node) {
    const ch = node.chapter;
    const mod = node.module;

    let totalTools = 0;
    ch.sections.forEach(s => totalTools += (s.tools ? s.tools.length : 0));

    const { prevTopic, nextTopic } = getAdjacentTopics(ch.id);

    el.viewerContent.innerHTML = `
      <!-- Hero Header -->
      <div class="hero-header">
        <div class="hero-badges-row">
          <span class="badge-tag ${mod.id}">${mod.shortTitle}</span>
          ${ch.tabName ? `<span class="badge-tag">${ch.tabName}</span>` : ''}
          <span class="badge-tag">${ch.sections.length} ផ្នែក</span>
          ${totalTools > 0 ? `<span class="badge-tag">${totalTools} ឧបករណ៍/មេរៀន</span>` : ''}
        </div>
        <h1 class="hero-title">${ch.title}</h1>
      </div>

      <!-- Ribbon Toolbar Screenshot if available -->
      ${ch.ribbonImage ? `
        <div class="feature-card" style="margin-bottom: 24px; padding: 14px;">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">
            🖼️ ផ្ទាំង Ribbon Toolbar នៃជំពូកនេះ (ចុចដើម្បីពង្រីកធំ)
          </div>
          <div class="doc-img-wrap" style="margin: 0; width: 100%;">
            <img src="${ch.ribbonImage}" class="doc-img" alt="${ch.title} Ribbon" onclick="openLightbox('${ch.ribbonImage}')" />
          </div>
        </div>
      ` : ''}

      <!-- Chapter Overview Text -->
      ${ch.html ? `
        <div class="feature-card card-notes" style="margin-bottom: 24px;">
          <div class="card-header-row">
            <div class="card-title-group">
              <span class="card-icon-pill">📖</span>
              <h3 class="card-title">សេចក្ដីណែនាំនៃជំពូក</h3>
            </div>
          </div>
          <div class="card-body rich-text">
            ${ch.html}
          </div>
        </div>
      ` : ''}

      <!-- Sections & Tools Grid -->
      <h3 style="font-size: 1.15rem; font-weight: 700; margin-top: 10px; margin-bottom: 14px; color: var(--text-primary);">
        📑 បញ្ជីក្រុមមុខងារ និងឧបករណ៍ក្នុងជំពូកនេះ៖
      </h3>

      <div class="cards-container">
        ${ch.sections.map(sec => `
          <div class="feature-card" style="padding: 18px 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; cursor: pointer;" onclick="window.appNavigateTo('${sec.id}')">
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">${sec.title}</h4>
              <span class="count-badge">${sec.tools && sec.tools.length > 0 ? `${sec.tools.length} ឧបករណ៍` : 'អត្ថបទ'}</span>
            </div>

            ${sec.html ? `<div class="rich-text" style="font-size: 0.9rem; margin-bottom: 12px;">${sec.html}</div>` : ''}

            ${sec.tools && sec.tools.length > 0 ? `
              <div class="tools-grid">
                ${sec.tools.map(t => `
                  <div class="tool-card" onclick="window.appNavigateTo('${t.id}')">
                    <div>
                      <div class="tool-card-title">
                        <span>${t.title}</span>
                        ${t.shortcut ? `<span class="badge-sc">${formatShortcutBadge(t.shortcut)}</span>` : ''}
                      </div>
                      <div class="tool-card-def">${t.definition || 'ចុចដើម្បីមើលព័ត៌មានលម្អិត...'}</div>
                    </div>
                    <div class="tool-card-footer">
                      <span>ចូលមើលមេរៀន</span>
                      <span>➔</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Bottom Navigation -->
      <div class="viewer-pagination">
        ${prevTopic ? `
          <div class="nav-topic-btn" onclick="window.appNavigateTo('${prevTopic.id}')">
            <span class="nav-direction-label">⬅️ មេរៀនមុន</span>
            <span class="nav-topic-title">${prevTopic.title}</span>
          </div>
        ` : '<div></div>'}

        ${nextTopic ? `
          <div class="nav-topic-btn" style="text-align: right; align-items: flex-end;" onclick="window.appNavigateTo('${nextTopic.id}')">
            <span class="nav-direction-label">មេរៀនបន្ទាប់ ➡️</span>
            <span class="nav-topic-title">${nextTopic.title}</span>
          </div>
        ` : '<div></div>'}
      </div>
    `;
  }

  // Render Section View (Level 3)
  function renderSectionContent(node) {
    const sec = node.section;
    const ch = node.chapter;
    const mod = node.module;

    const { prevTopic, nextTopic } = getAdjacentTopics(sec.id);

    el.viewerContent.innerHTML = `
      <div class="hero-header">
        <div class="hero-badges-row">
          <span class="badge-tag ${mod.id}">${mod.shortTitle}</span>
          <span class="badge-tag">${ch.shortTitle}</span>
          <span class="badge-tag">${sec.tools && sec.tools.length > 0 ? `${sec.tools.length} ឧបករណ៍` : 'ខ្លឹមសារមេរៀន'}</span>
        </div>
        <h1 class="hero-title">${sec.title}</h1>
      </div>

      ${sec.html ? `
        <div class="feature-card card-notes" style="margin-bottom: 24px;">
          <div class="card-body rich-text">
            ${sec.html}
          </div>
        </div>
      ` : ''}

      ${sec.tools && sec.tools.length > 0 ? `
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 14px; color: var(--text-primary);">
          🛠️ ឧបករណ៍នៅក្នុងក្រុមមុខងារនេះ៖
        </h3>
        <div class="tools-grid">
          ${sec.tools.map(t => `
            <div class="tool-card" onclick="window.appNavigateTo('${t.id}')">
              <div>
                <div class="tool-card-title">
                  <span>${t.title}</span>
                  ${t.shortcut ? `<span class="badge-sc">${formatShortcutBadge(t.shortcut)}</span>` : ''}
                </div>
                <div class="tool-card-def">${t.definition || 'ចុចដើម្បីមើលព័ត៌មានលម្អិត និងរបៀបប្រើ...'}</div>
              </div>
              <div class="tool-card-footer">
                <span>ចូលមើល</span>
                <span>➔</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Bottom Navigation -->
      <div class="viewer-pagination">
        ${prevTopic ? `
          <div class="nav-topic-btn" onclick="window.appNavigateTo('${prevTopic.id}')">
            <span class="nav-direction-label">⬅️ មេរៀនមុន</span>
            <span class="nav-topic-title">${prevTopic.title}</span>
          </div>
        ` : '<div></div>'}

        ${nextTopic ? `
          <div class="nav-topic-btn" style="text-align: right; align-items: flex-end;" onclick="window.appNavigateTo('${nextTopic.id}')">
            <span class="nav-direction-label">មេរៀនបន្ទាប់ ➡️</span>
            <span class="nav-topic-title">${nextTopic.title}</span>
          </div>
        ` : '<div></div>'}
      </div>
    `;
  }

  // Render Module Overview (Level 1)
  function renderModuleContent(node) {
    const mod = node.module;

    let totalTools = 0;
    mod.chapters.forEach(c => c.sections.forEach(s => totalTools += (s.tools ? s.tools.length : 0)));

    el.viewerContent.innerHTML = `
      <div class="hero-header">
        <div class="hero-badges-row">
          <span class="badge-tag ${mod.id}">${mod.badge}</span>
          <span class="badge-tag">${mod.chapters.length} ជំពូក</span>
          ${totalTools > 0 ? `<span class="badge-tag">${totalTools} ឧបករណ៍</span>` : ''}
        </div>
        <h1 class="hero-title">${mod.title}</h1>
        <div class="hero-subtitle">${mod.subtitle}</div>
      </div>

      ${mod.id === 'intro' ? `
        <div class="scripture-card">
          <div class="scripture-quote">${state.data.metadata.scripture}</div>
          <div class="scripture-ref">សៀវភៅកុំព្យូទ័រសម្រាប់ព័ន្ធកិច្ចពួកជំនុំ</div>
        </div>

        <div class="author-profile-card">
          <div class="author-photo-wrap">
            <img src="${state.data.metadata.authorImage || 'assets/images/pc_profile.png'}" class="author-photo-img" alt="គ្រូគង្វាល សារិក ហោន" onclick="openLightbox('assets/images/pc_profile.png')" style="cursor: zoom-in;" title="ចុចដើម្បីពង្រីកធំ" />
          </div>
          <div class="author-details-col">
            <div class="author-name-title">
              <span>គ្រូគង្វាល សារិក ហោន</span>
              <span class="author-en-name">(SARIK HORN)</span>
            </div>
            <div class="author-meta-row">
              <span class="author-meta-item">🏫 <strong>សាលាទេវវិទ្យា CPTIs</strong></span>
              <span class="author-meta-item">⛪ <strong>ពួកជំនុំបេសកកម្មនៃក្ដីសង្ឃឹម</strong></span>
            </div>
            <p class="author-bio-text">
              សូមព្រះគុណ សេចក្ដីស្រឡាញ់ និងសេចក្ដីសុខសាន្តរបស់ព្រះអម្ចាស់យេស៊ូវគ្រីស្ទ គង់នៅជាមួយអស់លោកគ្រូ អ្នកគ្រូ និងនិស្សិតសាលាគម្ពីរទាំងអស់គ្នា។ គ្រប់ទាំងអស់ដើម្បីថ្វាយសិរីរុងរឿងដល់ព្រះ (SOLI DEO GLORIA)។
            </p>
          </div>
        </div>
      ` : ''}

      <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 16px; color: var(--text-primary);">
        📚 បញ្ជីជំពូកក្នុងវគ្គសិក្សានេះ៖
      </h3>

      <div class="cards-container">
        ${mod.chapters.map(ch => `
          <div class="feature-card" style="cursor: pointer; padding: 18px 20px;" onclick="window.appNavigateTo('${ch.id}')">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-primary);">${ch.title}</h4>
              <span class="count-badge">${ch.sections.length} ផ្នែក</span>
            </div>
            ${ch.tabName ? `<div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">ផ្ទាំងមុខងារ៖ <strong>${ch.tabName}</strong></div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  // Get previous and next topics
  function getAdjacentTopics(currentId) {
    const idx = state.flattenedTopics.findIndex(t => t.id === currentId);
    if (idx === -1) return { prevTopic: null, nextTopic: null };

    const prevTopic = idx > 0 ? state.flattenedTopics[idx - 1] : null;
    const nextTopic = idx < state.flattenedTopics.length - 1 ? state.flattenedTopics[idx + 1] : null;

    return { prevTopic, nextTopic };
  }

  // Bind UI Events
  function bindEvents() {
    // Search input
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        if (el.searchClearBtn) {
          el.searchClearBtn.style.display = state.searchQuery ? 'block' : 'none';
        }
        renderTree();
      });

      // Keyboard shortcuts
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== el.searchInput)) {
          e.preventDefault();
          el.searchInput.focus();
        } else if (e.key === 'Escape') {
          closeLightbox();
          if (document.activeElement === el.searchInput) {
            el.searchInput.blur();
          }
        } else if (e.key === 'ArrowRight' && document.activeElement !== el.searchInput && state.activeNodeId !== 'home') {
          const { nextTopic } = getAdjacentTopics(state.activeNodeId);
          if (nextTopic) navigateTo(nextTopic.id);
        } else if (e.key === 'ArrowLeft' && document.activeElement !== el.searchInput && state.activeNodeId !== 'home') {
          const { prevTopic } = getAdjacentTopics(state.activeNodeId);
          if (prevTopic) navigateTo(prevTopic.id);
        }
      });
    }

    // Clear search button
    if (el.searchClearBtn) {
      el.searchClearBtn.addEventListener('click', () => {
        el.searchInput.value = '';
        state.searchQuery = '';
        el.searchClearBtn.style.display = 'none';
        renderTree();
        el.searchInput.focus();
      });
    }

    // Filter Chips
    el.filterChips.forEach(chip => {
      chip.addEventListener('click', () => {
        el.filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        state.activeFilter = chip.getAttribute('data-mod') || 'all';
        renderTree();
      });
    });

    // Theme Toggle
    if (el.themeToggleBtn) {
      el.themeToggleBtn.addEventListener('click', () => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
      });
    }

    // Font Size Controls (A-, A, A+)
    if (el.fontIncBtn) {
      el.fontIncBtn.addEventListener('click', () => {
        if (state.fontSizeLevel < fontSizes.length - 1) {
          state.fontSizeLevel++;
          applyFontSize(true);
        } else {
          showToast('ទំហំអក្សរធំបំផុតហើយ (20px)');
        }
      });
    }

    if (el.fontDecBtn) {
      el.fontDecBtn.addEventListener('click', () => {
        if (state.fontSizeLevel > 0) {
          state.fontSizeLevel--;
          applyFontSize(true);
        } else {
          showToast('ទំហំអក្សរតូចបំផុតហើយ (14px)');
        }
      });
    }

    if (el.fontResetBtn) {
      el.fontResetBtn.addEventListener('click', () => {
        state.fontSizeLevel = 1; // 16px normal
        applyFontSize(true);
      });
    }

    // Expand / Collapse All Toggle Button
    let isAllExpanded = false;
    if (el.expandAllBtn) {
      el.expandAllBtn.addEventListener('click', () => {
        const allChapters = document.querySelectorAll('.chapter-list, .section-list, .tool-list');
        const allHeaders = document.querySelectorAll('.module-header, .chapter-header, .section-header');

        isAllExpanded = !isAllExpanded;

        if (isAllExpanded) {
          allChapters.forEach(c => c.classList.add('open'));
          allHeaders.forEach(h => h.classList.add('expanded'));
          el.expandAllBtn.classList.add('active');
          el.expandAllBtn.setAttribute('title', 'បង្រួមមាតិកាទាំងអស់ (Collapse All)');
          el.expandAllBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="17 11 12 6 7 11"></polyline>
              <polyline points="17 18 12 13 7 18"></polyline>
            </svg>
          `;
          if (el.mExpandText) el.mExpandText.textContent = 'បង្រួមមាតិកាទាំងអស់';
          showToast('បានបើកពង្រីកមាតិកាទាំងអស់');
        } else {
          allChapters.forEach(c => c.classList.remove('open'));
          allHeaders.forEach(h => h.classList.remove('expanded'));
          el.expandAllBtn.classList.remove('active');
          el.expandAllBtn.setAttribute('title', 'ពង្រីកមាតិកាទាំងអស់ (Expand All)');
          el.expandAllBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="7 13 12 18 17 13"></polyline>
              <polyline points="7 6 12 11 17 6"></polyline>
            </svg>
          `;
          if (el.mExpandText) el.mExpandText.textContent = 'ពង្រីកមាតិកាទាំងអស់';
          showToast('បានបង្រួមមាតិកាទាំងអស់');
        }
      });
    }

    // Connect mobile popover font & expand buttons
    if (el.mFontDecBtn && el.fontDecBtn) el.mFontDecBtn.addEventListener('click', () => el.fontDecBtn.click());
    if (el.mFontResetBtn && el.fontResetBtn) el.mFontResetBtn.addEventListener('click', () => el.fontResetBtn.click());
    if (el.mFontIncBtn && el.fontIncBtn) el.mFontIncBtn.addEventListener('click', () => el.fontIncBtn.click());
    if (el.mExpandAllBtn && el.expandAllBtn) el.mExpandAllBtn.addEventListener('click', () => el.expandAllBtn.click());

    // Fallback for older browsers without native popover support
    if (el.mobileMoreBtn && el.mobileMorePopover) {
      if (!('popover' in HTMLElement.prototype)) {
        el.mobileMoreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          el.mobileMorePopover.classList.toggle('open-fallback');
        });
        document.addEventListener('click', (e) => {
          if (!el.mobileMorePopover.contains(e.target) && e.target !== el.mobileMoreBtn) {
            el.mobileMorePopover.classList.remove('open-fallback');
          }
        });
      }
    }

    // Print Button
    if (el.printBtn) {
      el.printBtn.addEventListener('click', () => {
        window.print();
      });
    }

    // Mobile Sidebar Toggle
    if (el.mobileMenuBtn && el.sidebar && el.sidebarBackdrop) {
      el.mobileMenuBtn.addEventListener('click', () => {
        el.sidebar.classList.toggle('open');
        el.sidebarBackdrop.classList.toggle('open');
      });

      el.sidebarBackdrop.addEventListener('click', closeMobileSidebar);
    }

    // Lightbox Close
    if (el.lightboxClose && el.lightbox) {
      el.lightboxClose.addEventListener('click', closeLightbox);
      el.lightbox.addEventListener('click', (e) => {
        if (e.target === el.lightbox || e.target === el.lightboxImg) {
          closeLightbox();
        }
      });
    }
  }

  function closeMobileSidebar() {
    if (el.sidebar) el.sidebar.classList.remove('open');
    if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('open');
  }

  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('agy_theme', theme);
    if (el.themeToggleBtn) {
      el.themeToggleBtn.innerHTML = theme === 'light' ? '🌙' : '☀️';
      el.themeToggleBtn.title = theme === 'light' ? 'ប្ដូរទៅ Dark Mode' : 'ប្ដូរទៅ Light Mode';
    }
  }

  function formatShortcutKeycaps(sc) {
    if (!sc) return '';
    const parts = sc.split(/\s*[\+\|]\s*/);
    return parts.map(p => `<kbd>${p.trim()}</kbd>`).join(' + ');
  }

  function formatShortcutBadge(sc) {
    if (!sc) return '';
    const m = sc.match(/(?:Ctrl|Alt|Shift)[^\s\,]+/);
    return m ? m[0] : sc.substring(0, 10);
  }

  function formatShortcutText(text) {
    if (!text) return '';
    const pattern = /\b(Ctrl|Alt|Shift|Enter|Tab|Esc|Windows|Win)\s*\+\s*([A-Za-z0-9\[\]\=\-\+\>\<\_]+(?:\s*\+\s*[A-Za-z0-9\[\]\=\-\+\>\<\_]+)*)/g;
    return text.replace(pattern, '<kbd>$&</kbd>');
  }

  function htmlEscape(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function escapeJsString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  window.openLightbox = function (imgSrc) {
    if (el.lightbox && el.lightboxImg) {
      el.lightboxImg.src = imgSrc;
      el.lightbox.classList.add('open');
    }
  };

  function closeLightbox() {
    if (el.lightbox) {
      el.lightbox.classList.remove('open');
    }
  }

  window.appCopyText = function (text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast('បានចម្លងរួចរាល់! (Copied)');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('បានចម្លងរួចរាល់!');
    });
  };

  function showToast(msg) {
    if (!el.toast || !el.toastMsg) return;
    el.toastMsg.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
    }, 2400);
  }

  window.appNavigateTo = function (id) {
    navigateTo(id);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
