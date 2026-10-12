(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const floatingCta = document.getElementById('floating-cta');
  const typeNodes = [...document.querySelectorAll('[data-type]')];
  const sequenceEl = document.getElementById('story-sequence');

  document.documentElement.classList.add('js');

  const animatedSections = [...document.querySelectorAll('main > .section')];
  const canAnimate = !reducedMotion.matches && 'IntersectionObserver' in window;

  if (canAnimate) {
    sequenceEl?.classList.add('is-armed');
    typeNodes.forEach(el => {
      const lines = [];
      let current = '';
      el.childNodes.forEach(node => {
        if (node.nodeName === 'BR') { lines.push(current); current = ''; }
        else current += node.textContent;
      });
      lines.push(current);
      const cleaned = lines.map(line => line.replace(/\s+/g, ' ').trim());
      const copy = cleaned.join(' ');
      const fragment = document.createDocumentFragment();
      el.classList.add('word-reveal');
      el.setAttribute('aria-label', copy);
      el.textContent = '';
      cleaned.forEach((line, lineIndex) => {
        if (lineIndex > 0) fragment.append(document.createElement('br'));
        line.split(' ').forEach((word, index, words) => {
          const token = document.createElement('span');
          token.className = 'word-reveal__token';
          token.setAttribute('aria-hidden', 'true');
          const ink = document.createElement('span');
          ink.className = 'word-reveal__ink';
          ink.textContent = word;
          token.append(ink);
          fragment.append(token);
          if (index < words.length - 1) fragment.append(' ');
        });
      });
      el.append(fragment);
      el.addEventListener('animationend', e => {
        if (e.animationName === 'word-focus') e.target.closest('.word-reveal__token')?.classList.add('is-complete');
      });
    });
  }

  let sequencePlayed = false;
  const playSequence = () => {
    if (sequencePlayed || !sequenceEl) return;
    sequencePlayed = true;
    const parts = [...sequenceEl.children];
    let delay = 60;
    parts.forEach(part => {
      const isArrow = part.classList.contains('sequence__arrow');
      window.setTimeout(() => part.classList.add('is-shown'), delay);
      delay += isArrow ? 480 : 420;
    });
  };

  const wordStates = new WeakMap();
  let currentSection = null;
  let cancelPurchaseExplosion = () => {};
  const setFloatingCta = section => {
    if (!floatingCta) return;
    const visible = !!section && animatedSections.indexOf(section) >= 3 && section.id !== 'purchase';
    floatingCta.classList.toggle('is-visible', visible);
    floatingCta.setAttribute('aria-hidden', String(!visible));
    if (visible) floatingCta.removeAttribute('inert');
    else floatingCta.setAttribute('inert', '');
  };
  const stateFor = section => {
    if (!wordStates.has(section)) {
      const words = [];
      section.querySelectorAll('[data-type]').forEach(line => {
        line.classList.add('is-started');
        const tokens = [...line.querySelectorAll('.word-reveal__token')];
        tokens.forEach((token, index) => words.push({ token, pause: index === tokens.length - 1 ? 210 : 0 }));
      });
      wordStates.set(section, { words, index: 0, timer: 0, started: false });
    }
    return wordStates.get(section);
  };
  const pauseSection = section => {
    if (!section) return;
    section.classList.remove('is-current');
    if (section.id === 'purchase') cancelPurchaseExplosion();
    const state = wordStates.get(section);
    if (state?.timer) { clearTimeout(state.timer); state.timer = 0; }
    section.querySelectorAll('.word-reveal__token.is-visible').forEach(token => token.classList.add('is-complete'));
  };
  const showNextWord = (section, state) => {
    state.timer = 0;
    if (currentSection !== section || state.index >= state.words.length) return;
    const { token, pause } = state.words[state.index++];
    token.classList.add('is-visible');
    if (state.index >= state.words.length && section.id === 'intelligence') {
      window.setTimeout(playSequence, 650);
    }
    const pace = Math.max(32, Math.min(46, 2200 / Math.max(1, state.words.length)));
    state.timer = window.setTimeout(() => showNextWord(section, state), pace + pause);
  };
  const activateSection = section => {
    if (currentSection !== section) {
      pauseSection(currentSection);
      currentSection = section;
      section.classList.add('is-current');
      setFloatingCta(section);
    }
    if (!section.dataset.activated) {
      section.dataset.activated = 'true';
      section.classList.add('in-view');
      section.querySelectorAll('.reveal, .reveal-card').forEach((el, index) => {
        if (index === 0) el.classList.add('in-view');
        else window.setTimeout(() => el.classList.add('in-view'), index * 140);
      });
    }
    const state = stateFor(section);
    if (state.words.length && !state.timer && state.index < state.words.length) {
      const delay = state.started ? 70 : 250;
      state.started = true;
      state.timer = window.setTimeout(() => showNextWord(section, state), delay);
    }
  };

  if (canAnimate) {
    let sectionFrame = 0;
    const updateActiveSection = () => {
      sectionFrame = 0;
      const middle = window.innerHeight / 2;
      let nearest = null;
      let nearestDistance = Infinity;
      for (const section of animatedSections) {
        const rect = section.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
        const distance = rect.top <= middle && rect.bottom >= middle
          ? 0
          : Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
        if (distance < nearestDistance) {
          nearest = section;
          nearestDistance = distance;
        }
      }
      if (nearest) activateSection(nearest);
    };
    const scheduleActiveSection = () => {
      if (!sectionFrame) sectionFrame = requestAnimationFrame(updateActiveSection);
    };
    const galleryObserver = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    }, { threshold: .14 });
    const start = () => {
      document.querySelectorAll('.gallery-card').forEach(card => galleryObserver.observe(card));
      scheduleActiveSection();
    };
    window.addEventListener('scroll', scheduleActiveSection, { passive: true });
    window.addEventListener('resize', scheduleActiveSection, { passive: true });
    window.addEventListener('pageshow', scheduleActiveSection);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleActiveSection();
    });
    if (document.body.classList.contains('is-loading')) {
      document.addEventListener('sensor:ready', start, { once: true });
    } else start();
  } else {
    animatedSections.forEach(section => {
      section.classList.add('in-view');
      section.querySelectorAll('.reveal, .reveal-card').forEach(el => el.classList.add('in-view'));
    });
    document.querySelectorAll('.gallery-card').forEach(card => card.classList.add('in-view'));
    let dockFrame = 0;
    const updateDock = () => {
      dockFrame = 0;
      const middle = window.innerHeight / 2;
      const section = animatedSections.find(item => {
        const rect = item.getBoundingClientRect();
        return rect.top <= middle && rect.bottom >= middle;
      });
      setFloatingCta(section);
    };
    const scheduleDock = () => { if (!dockFrame) dockFrame = requestAnimationFrame(updateDock); };
    window.addEventListener('scroll', scheduleDock, { passive: true });
    window.addEventListener('resize', scheduleDock, { passive: true });
    if (document.body.classList.contains('is-loading')) {
      document.addEventListener('sensor:ready', scheduleDock, { once: true });
    } else scheduleDock();
  }

  const stage = document.getElementById('showcase-stage');
  if (stage) {
    let fitFrame = 0;
    const fitCards = () => {
      fitFrame = 0;
      const bottoms = [...stage.querySelectorAll('.card')].map(card => card.offsetTop + card.offsetHeight);
      stage.style.minHeight = `${Math.ceil(Math.max(0, ...bottoms) + 70)}px`;
    };
    const scheduleFit = () => { if (!fitFrame) fitFrame = requestAnimationFrame(fitCards); };
    document.fonts.ready.then(scheduleFit);
    document.addEventListener('sensor:ready', scheduleFit, { once: true });
    window.addEventListener('resize', scheduleFit, { passive: true });
  }
  if (stage && window.matchMedia('(pointer:fine)').matches && !reducedMotion.matches) {
    const cards = [...stage.querySelectorAll('.card')];
    let frame = 0;
    stage.addEventListener('pointermove', event => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        const rect = stage.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        cards.forEach((card, index) => {
          const depth = index === 0 ? 10 : -13;
          card.style.setProperty('--tilt-x', `${(x * depth).toFixed(1)}px`);
          card.style.setProperty('--tilt-y', `${(y * depth).toFixed(1)}px`);
        });
        frame = 0;
      });
    }, { passive: true });
    stage.addEventListener('pointerleave', () => cards.forEach(card => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    }));
  }

  const gallery = document.getElementById('gallery-stage');
  if (gallery) {
    const cards = [...gallery.querySelectorAll('.gallery-card')];
    const dialog = document.getElementById('gallery-dialog');
    const dialogImage = dialog.querySelector('img');
    let returnFocus = null;
    let closeTimer = 0;
    const closeLightbox = () => {
      if (!dialog.open) return;
      dialog.classList.remove('is-open');
      clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => dialog.close(), reducedMotion.matches ? 0 : 300);
    };
    cards.forEach(card => card.addEventListener('click', () => {
      const source = card.querySelector('img');
      returnFocus = card;
      dialogImage.src = source.src;
      dialogImage.alt = source.alt;
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => requestAnimationFrame(() => dialog.classList.add('is-open')));
    }));
    dialog.querySelector('.gallery-dialog__close').addEventListener('click', closeLightbox);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeLightbox(); });
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeLightbox(); });
    dialog.addEventListener('close', () => {
      dialog.classList.remove('is-open');
      returnFocus?.focus({ preventScroll: true });
      returnFocus = null;
    });

    if (!reducedMotion.matches) {
      let frame = 0;
      let activePhase = 0;
      let desiredPhase = 0;
      let phaseTimer = 0;
      let releaseTimer = 0;
      const setLayering = phase => cards.forEach((card, index) => {
        card.style.zIndex = String(((index + phase) % cards.length) + 1);
      });
      const moveLayering = phase => {
        desiredPhase = phase;
        if (phase === activePhase) return;
        if (phaseTimer) {
          if (Math.abs(phase - activePhase) > 1) cards.forEach(card => card.classList.add('is-passing'));
          return;
        }
        clearTimeout(releaseTimer);
        cards.forEach(card => card.classList.remove('is-passing'));
        if (Math.abs(phase - activePhase) > 1) cards.forEach(card => card.classList.add('is-passing'));
        else {
          const crossingIndex = phase > activePhase
            ? (cards.length - phase) % cards.length
            : (cards.length - activePhase) % cards.length;
          cards[crossingIndex].classList.add('is-passing');
        }
        phaseTimer = window.setTimeout(() => {
          activePhase = desiredPhase;
          setLayering(activePhase);
          phaseTimer = 0;
          releaseTimer = window.setTimeout(() => cards.forEach(card => card.classList.remove('is-passing')), 150);
        }, 150);
      };
      setLayering(0);
      const updateGallery = () => {
        frame = 0;
        const rect = gallery.getBoundingClientRect();
        if (rect.top > innerHeight + 250 || rect.bottom < -250) return;
        const progress = Math.min(1, Math.max(0, (innerHeight - rect.top) / (innerHeight + rect.height)));
        const scale = innerWidth < 560 ? .8 : innerWidth < 760 ? .65 : 1;
        const phase = Math.min(cards.length - 1, Math.floor(progress * cards.length));
        cards.forEach(card => {
          const dx = Number(card.dataset.dx) * progress * scale;
          const dy = Number(card.dataset.dy) * progress * scale;
          const angle = Number(card.dataset.angle) + Number(card.dataset.spin) * progress;
          card.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;
        });
        if (innerWidth > 560) moveLayering(phase);
        else {
          clearTimeout(phaseTimer);
          clearTimeout(releaseTimer);
          phaseTimer = 0;
          activePhase = desiredPhase = 0;
          cards.forEach(card => card.classList.remove('is-passing'));
          setLayering(0);
        }
      };
      const scheduleGallery = () => { if (!frame) frame = requestAnimationFrame(updateGallery); };
      window.addEventListener('scroll', scheduleGallery, { passive: true });
      window.addEventListener('resize', scheduleGallery, { passive: true });
      updateGallery();
    }
  }

  const purchaseHeading = document.getElementById('purchase-title');
  const burstTrigger = purchaseHeading?.querySelector('em');
  const purchaseButton = document.querySelector('.purchase__button');
  const purchaseFooter = document.querySelector('.purchase .footer');
  if (purchaseHeading && burstTrigger && purchaseButton && purchaseFooter && !reducedMotion.matches) {
    const outline = purchaseHeading.cloneNode(true);
    outline.removeAttribute('id');
    outline.className = 'purchase__heading purchase__heading--outline';
    outline.setAttribute('aria-hidden', 'true');
    outline.setAttribute('inert', '');
    purchaseHeading.after(outline);
    let particles = [];
    let particleLayer = null;
    let particleContext = null;
    let layerFade = null;
    let frame = 0;
    let lastFrame = 0;
    let burstTimer = 0;
    let restoreTimer = 0;
    let burstId = 0;
    let popAnimation = null;
    let busy = false;
    let restoring = false;
    const clearBurst = () => {
      burstId++;
      clearTimeout(burstTimer);
      clearTimeout(restoreTimer);
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrame = 0;
      popAnimation?.cancel();
      popAnimation = null;
      layerFade?.cancel();
      layerFade = null;
      particleLayer?.remove();
      particleLayer = null;
      particleContext = null;
      particles = [];
      busy = false;
      restoring = false;
      purchaseHeading.classList.remove('is-exploded', 'is-restoring');
      outline.classList.remove('is-visible');
    };
    cancelPurchaseExplosion = clearBurst;

    const addLetterRects = (node, rects) => {
      const source = node.textContent;
      const segments = 'Segmenter' in Intl
        ? [...new Intl.Segmenter('fa', { granularity: 'grapheme' }).segment(source)].map(part => ({ text: part.segment, index: part.index }))
        : [...source].reduce((result, text) => {
          result.push({ text, index: result.length ? result.at(-1).index + result.at(-1).text.length : 0 });
          return result;
        }, []);
      segments.forEach(({ text, index }) => {
        if (!text.trim()) return;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + text.length);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) rects.push(rect);
      });
    };

    const drawParticles = () => {
      if (!particleContext) return;
      particleContext.clearRect(0, 0, innerWidth, innerHeight);
      particles.forEach(particle => {
        const radius = particle.size / 2;
        const centerX = particle.x + radius;
        const centerY = particle.y + radius;
        particleContext.fillStyle = particle.color;
        particleContext.beginPath();
        particleContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
        particleContext.fill();
      });
    };

    const animateParticles = timestamp => {
      if (!busy || restoring) return;
      const dt = Math.min(.032, lastFrame ? (timestamp - lastFrame) / 1000 : .016);
      lastFrame = timestamp;
      let moving = false;
      particles.forEach(particle => {
        particle.age += dt;
        const t = Math.min(1, Math.max(0, particle.age / particle.duration));
        if (t < 1) {
          const inverse = 1 - t;
          particle.x = inverse ** 3 * particle.sx
            + 3 * inverse ** 2 * t * particle.c1x
            + 3 * inverse * t ** 2 * particle.c2x
            + t ** 3 * particle.tx;
          particle.y = particle.sy + (particle.ty - particle.sy) * t * t
            - particle.lift * Math.sin(Math.PI * t);
          moving = true;
        } else {
          particle.x = particle.tx;
          particle.y = particle.ty;
        }
      });
      drawParticles();
      frame = moving ? requestAnimationFrame(animateParticles) : 0;
    };

    const restore = id => {
      if (id !== burstId) return;
      restoring = true;
      cancelAnimationFrame(frame);
      frame = 0;
      popAnimation?.cancel();
      popAnimation = null;
      purchaseHeading.classList.remove('is-exploded');
      purchaseHeading.classList.add('is-restoring');
      outline.classList.remove('is-visible');
      if (particleLayer) {
        layerFade = particleLayer.animate([
          { opacity: 1, filter: 'blur(0px)' },
          { opacity: 0, filter: 'blur(10px)' }
        ], { duration: 420, easing: 'ease-out', fill: 'forwards' });
      }
      restoreTimer = window.setTimeout(clearBurst, 850);
    };

    const explode = () => {
      if (busy || !purchaseHeading.closest('.purchase.is-current')) return;
      busy = true;
      const id = ++burstId;
      const startWeight = Math.min(900, Number.parseInt(getComputedStyle(purchaseHeading).fontWeight, 10) || 800);
      popAnimation = purchaseHeading.animate([
        { fontWeight: String(startWeight), fontVariationSettings: `"wght" ${startWeight},"CNTR" 50` },
        { fontWeight: '900', fontVariationSettings: '"wght" 900,"CNTR" 50' }
      ], { duration: 640, easing: 'cubic-bezier(.25,.1,.25,1)', fill: 'forwards' });

      popAnimation.finished.then(() => {
        if (id !== burstId) return;
        const rects = [];
        addLetterRects(purchaseHeading.firstChild, rects);
        addLetterRects(burstTrigger.firstChild, rects);
        if (!rects.length) { clearBurst(); return; }
        const button = purchaseButton.getBoundingClientRect();
        const footer = purchaseFooter.getBoundingClientRect();
        const total = Math.round(Math.min(165, Math.max(46, innerWidth / 9.2)));
        const buttonCount = Math.min(9, Math.max(4, Math.round(total * .055)));
        const colors = [
          [111, 49, 80], [126, 58, 91], [103, 42, 73],
          [146, 70, 106], [114, 50, 82], [94, 43, 72]
        ];
        const landed = { button: [], footer: [] };
        const settle = (roof, group, size) => {
          const radius = size / 2;
          const inset = Math.min(12, roof.width * .025);
          const left = roof.left + inset + radius;
          const right = Math.max(left, roof.right - inset - radius);
          let best = null;
          for (let attempt = 0; attempt < 4; attempt++) {
            const x = left + Math.random() * (right - left);
            let y = roof.top - radius + 1;
            for (const dot of landed[group]) {
              const reach = radius + dot.radius - .2;
              const dx = x - dot.x;
              if (Math.abs(dx) < reach) {
                y = Math.min(y, dot.y - Math.sqrt(reach * reach - dx * dx));
              }
            }
            const score = roof.top - radius - y + Math.random() * 15;
            if (!best || score < best.score) best = { x, y, score };
          }
          landed[group].push({ x: best.x, y: best.y, radius });
          return { x: best.x - radius, y: best.y - radius };
        };
        const layer = document.createElement('canvas');
        layer.className = 'burst-layer';
        layer.setAttribute('aria-hidden', 'true');
        const ratio = Math.min(2, devicePixelRatio || 1);
        layer.width = Math.round(innerWidth * ratio);
        layer.height = Math.round(innerHeight * ratio);
        particleContext = layer.getContext('2d', { alpha: true });
        if (!particleContext) { clearBurst(); return; }
        particleContext.setTransform(ratio, 0, 0, ratio, 0, 0);
        for (let index = 0; index < total; index++) {
          const rect = rects[Math.floor(Math.random() * rects.length)];
          const onButton = index < buttonCount;
          const sizeScale = Math.min(1, Math.max(.78, innerWidth / 650));
          const sizeRoll = Math.random();
          const size = (sizeRoll < .18 ? 3.5 + Math.random() * 2.5
            : sizeRoll < .78 ? 6.5 + Math.random() * 5
              : 12 + Math.random() * 5) * sizeScale;
          const sx = rect.left + rect.width * (.1 + Math.random() * .8) - size / 2;
          const sy = rect.top + rect.height * (.15 + Math.random() * .7) - size / 2;
          const target = settle(onButton ? button : footer, onButton ? 'button' : 'footer', size);
          const { x: tx, y: ty } = target;
          const dx = tx - sx;
          const color = colors[Math.floor(Math.random() * colors.length)];
          particles.push({ sx, sy, x: sx, y: sy, tx, ty, size,
            color: `rgba(${color.join(',')},${(.57 + Math.random() * .38).toFixed(2)})`,
            c1x: sx + dx * (.1 + Math.random() * .35),
            c2x: sx + dx * (.55 + Math.random() * .35),
            lift: 30 + Math.min(90, Math.max(0, ty - sy) * .12) + Math.random() * 62,
            duration: (onButton ? .57 : .66) + Math.random() * .37,
            age: -Math.random() * .12 });
        }
        document.body.append(layer);
        particleLayer = layer;
        purchaseHeading.classList.add('is-exploded');
        outline.classList.add('is-visible');
        drawParticles();
        lastFrame = 0;
        frame = requestAnimationFrame(animateParticles);
        burstTimer = window.setTimeout(() => restore(id), 4000);
      }).catch(() => {});
    };
    if (window.matchMedia('(pointer:fine)').matches) purchaseHeading.addEventListener('pointerenter', explode);
    window.addEventListener('resize', () => { if (busy) clearBurst(); }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && busy) clearBurst(); });
  }
  (() => {
    const sections = [...document.querySelectorAll('main > .section')];
    if (!sections.length) return;
    const titleOf = section => {
      const label = section.getAttribute('aria-label');
      if (label) return label;
      const heading = section.querySelector('h1, h2');
      if (!heading) return section.id;
      const aria = heading.getAttribute('aria-label');
      if (aria) return aria;
      const clone = heading.cloneNode(true);
      clone.querySelectorAll('.showcase__heading-tail').forEach(node => node.remove());
      return clone.textContent.replace(/\s+/g, ' ').trim();
    };
    const nav = document.createElement('nav');
    nav.className = 'slide-orbit is-hidden';
    nav.setAttribute('aria-label', 'اسلایدها');
    nav.style.setProperty('--n', sections.length);
    const stage = document.createElement('div');
    stage.className = 'slide-orbit__stage';
    const ring = document.createElement('span');
    ring.className = 'slide-orbit__ring';
    ring.setAttribute('aria-hidden', 'true');
    const fillWrap = document.createElement('span');
    fillWrap.className = 'slide-orbit__fill-wrap';
    fillWrap.setAttribute('aria-hidden', 'true');
    const fillRing = document.createElement('span');
    fillRing.className = 'slide-orbit__fill-ring';
    fillWrap.append(fillRing);
    stage.append(ring, fillWrap);
    const items = sections.map((section, index) => {
      const link = document.createElement('a');
      link.className = 'slide-orbit__dot';
      link.href = '#' + section.id;
      link.style.setProperty('--i', index);
      ['base', 'fill', 'pulse'].forEach(part => {
        const layer = document.createElement('i');
        layer.className = 'slide-orbit__' + part;
        layer.setAttribute('aria-hidden', 'true');
        link.append(layer);
      });
      const text = document.createElement('span');
      text.className = 'slide-orbit__label';
      text.textContent = titleOf(section);
      link.append(text);
      link.addEventListener('click', event => {
        event.preventDefault();
        section.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
      });
      stage.append(link);
      return { section, link };
    });
    nav.append(stage);
    document.body.append(nav);

    let active = -1;
    let frame = 0;
    const buildHoles = () => {
      const size = ring.offsetWidth;
      if (!size) return;
      const step = parseFloat(getComputedStyle(nav).getPropertyValue('--step')) || 3.05;
      const radius = (size - 1) / 2;
      const center = size / 2;
      const layers = items.map((_, index) => {
        const angle = (index - (items.length - 1) / 2) * step * Math.PI / 180;
        const x = (center + radius * Math.cos(angle)).toFixed(2);
        const y = (center + radius * Math.sin(angle)).toFixed(2);
        return `radial-gradient(circle at ${x}px ${y}px,transparent 0,transparent 4.1px,#000 4.9px)`;
      });
      nav.style.setProperty('--orbit-holes', layers.join(','));
    };
    const update = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let best = 0;
      let bestDistance = Infinity;
      items.forEach(({ section }, index) => {
        const rect = section.getBoundingClientRect();
        const distance = rect.top <= middle && rect.bottom >= middle
          ? 0
          : Math.min(Math.abs(rect.top - middle), Math.abs(rect.bottom - middle));
        if (distance < bestDistance) { best = index; bestDistance = distance; }
      });
      if (best !== active) {
        if (active >= 0) {
          items[active].link.classList.remove('is-active');
          items[active].link.removeAttribute('aria-current');
        }
        active = best;
        items[active].link.classList.add('is-active');
        items[active].link.setAttribute('aria-current', 'true');
      }
      nav.classList.toggle('is-hidden', active === 0);
      items.forEach((item, index) => item.link.classList.toggle('is-passed', index < active));
      const step = parseFloat(getComputedStyle(nav).getPropertyValue('--step')) || 3.05;
      const last = active === items.length - 1;
      const angle = last ? 140 : 90 + (active - (items.length - 1) / 2) * step;
      fillWrap.style.setProperty('--orbit-fill', angle + 'deg');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', () => { buildHoles(); schedule(); }, { passive: true });
    document.addEventListener('sensor:ready', () => { buildHoles(); schedule(); }, { once: true });
    buildHoles();
    update();
  })();
})();
