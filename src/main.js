import { gsap } from "gsap";

const SELECTORS = {
  sceneVideo: "#g2SceneVideo",
  chapters: "[data-chapter]",
  motion: ".chapter-motion",
  dots: ".chapter-dots button",
  navToggle: ".nav-toggle",
  navLinks: ".site-nav a",
  internalLinks: 'a[href^="#"]',
  chapterCurrent: "#chapterCurrent",
  chapterName: "#chapterName",
  solutionsSection: "#solutions",
  solutionsPinWrap: ".solutions-pin-wrap",
  solutionStack: "[data-solution-stack]",
  solutionCards: "[data-solution-stack] .solution-card",
  solutionCurrent: "[data-solution-current]",
  solutionTitle: "[data-solution-title]",
  solutionProgress: "[data-solution-progress]",
};

const CHAPTERS = [
  { id: "hero", label: "Sistema G2", progress: 0 },
  { id: "solutions", label: "Solu\u00e7\u00f5es", progress: 0.24 },
  { id: "applications", label: "Aplica\u00e7\u00f5es", progress: 0.48 },
  { id: "process", label: "Processo", progress: 0.72 },
  { id: "contact", label: "Contato", progress: 1 },
];

document.addEventListener("DOMContentLoaded", () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.documentElement.classList.toggle("reduced-motion", reducedMotion);

  const scene = createScrollVideoScene({ reducedMotion });
  const controller = createChapterController({ scene, reducedMotion });
  const solutionStack = createPinnedSolutionStack({ scene, reducedMotion });

  scene.start();
  controller.start();
  solutionStack.start();
});

function createChapterController({ scene, reducedMotion }) {
  const chapters = CHAPTERS.map((chapter, index) => ({
    ...chapter,
    index,
    node: document.getElementById(chapter.id),
  })).filter((chapter) => chapter.node);

  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const dots = Array.from(document.querySelectorAll(SELECTORS.dots));
  const navLinks = Array.from(document.querySelectorAll(SELECTORS.navLinks));
  const internalLinks = Array.from(document.querySelectorAll(SELECTORS.internalLinks))
    .filter((link) => chapterIds.has(link.hash.replace("#", "")));
  const navToggle = document.querySelector(SELECTORS.navToggle);
  const currentChapter = document.querySelector(SELECTORS.chapterCurrent);
  const chapterName = document.querySelector(SELECTORS.chapterName);

  let activeIndex = -1;
  let scrollFrame = 0;

  function start() {
    setupMotion();
    bindNavigation();
    bindKeyboard();
    updateFromScroll();

    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleScrollUpdate);
    window.addEventListener("hashchange", handleHashChange);

    const initialTarget = getHashTarget();
    if (initialTarget) {
      setActiveChapter(initialTarget.index, true);
    }
  }

  function setupMotion() {
    const motionNodes = Array.from(document.querySelectorAll(SELECTORS.motion));

    if (!motionNodes.length) {
      return;
    }

    if (reducedMotion || !("IntersectionObserver" in window)) {
      motionNodes.forEach((node) => node.classList.add("is-visible"));
      gsap.set(motionNodes, { autoAlpha: 1, y: 0, clearProps: "transform" });
      return;
    }

    gsap.set(motionNodes, { autoAlpha: 0, y: 22 });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        gsap.to(entry.target, {
          autoAlpha: 1,
          y: 0,
          duration: 0.65,
          ease: "power3.out",
        });
        observer.unobserve(entry.target);
      });
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.18,
    });

    motionNodes.forEach((node) => observer.observe(node));
  }

  function bindNavigation() {
    internalLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetId = link.hash.replace("#", "");

        if (!chapterById.has(targetId)) {
          return;
        }

        event.preventDefault();
        scrollToChapter(targetId, true);
      });
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        const targetId = dot.dataset.target;

        if (targetId) {
          scrollToChapter(targetId, true);
        }
      });
    });

    navToggle?.addEventListener("click", () => {
      const isOpen = document.body.classList.toggle("nav-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  function bindKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) {
        return;
      }

      if (event.key === "Escape") {
        closeNavigation();
        return;
      }

      if (isInteractiveTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      const nextKeys = new Set(["ArrowDown", "PageDown"]);
      const previousKeys = new Set(["ArrowUp", "PageUp"]);

      if (nextKeys.has(event.key)) {
        event.preventDefault();
        moveToRelativeChapter(1);
      }

      if (previousKeys.has(event.key)) {
        event.preventDefault();
        moveToRelativeChapter(-1);
      }

      if (event.key === "Home") {
        event.preventDefault();
        scrollToChapter(chapters[0]?.id, true);
      }

      if (event.key === "End") {
        event.preventDefault();
        scrollToChapter(chapters.at(-1)?.id, true);
      }
    });
  }

  function handleHashChange() {
    const target = getHashTarget();

    if (target) {
      setActiveChapter(target.index, true);
    }
  }

  function scheduleScrollUpdate() {
    if (scrollFrame) {
      return;
    }

    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      updateFromScroll();
    });
  }

  function updateFromScroll() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress = scrollHeight > 0 ? window.scrollY / scrollHeight : 0;

    scene.setProgress(scrollProgress);
    setActiveChapter(getChapterIndexFromScroll(), false);
  }

  function getChapterIndexFromScroll() {
    if (!chapters.length) {
      return 0;
    }

    const scrollAnchor = window.scrollY + window.innerHeight * 0.42;
    let selectedIndex = 0;

    chapters.forEach((chapter, index) => {
      const top = chapter.node.offsetTop;
      const bottom = top + chapter.node.offsetHeight;

      if (scrollAnchor >= top && scrollAnchor < bottom) {
        selectedIndex = index;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
      selectedIndex = chapters.length - 1;
    }

    return selectedIndex;
  }

  function setActiveChapter(index, syncScene) {
    const nextIndex = clamp(index, 0, chapters.length - 1);
    const activeChapter = chapters[nextIndex];

    if (!activeChapter || activeIndex === nextIndex) {
      return;
    }

    activeIndex = nextIndex;

    chapters.forEach((chapter, chapterIndex) => {
      chapter.node.classList.toggle("is-active", chapterIndex === activeIndex);
    });

    navLinks.forEach((link) => {
      const isCurrent = link.hash === `#${activeChapter.id}`;
      link.classList.toggle("is-active", isCurrent);

      if (isCurrent) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    dots.forEach((dot) => {
      const isCurrent = dot.dataset.target === activeChapter.id;
      dot.classList.toggle("is-active", isCurrent);

      if (isCurrent) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });

    if (currentChapter) {
      currentChapter.textContent = String(activeIndex + 1).padStart(2, "0");
    }

    if (chapterName) {
      chapterName.textContent = activeChapter.label;
    }

    document.body.classList.toggle("is-hero-active", activeChapter.id === "hero");
    document.body.classList.toggle("is-contact-active", activeChapter.id === "contact");
    document.body.classList.toggle("is-solutions-active", activeChapter.id === "solutions");

    if (syncScene) {
      scene.setProgress(activeChapter.progress);
    }
  }

  function scrollToChapter(targetId, updateHash) {
    const target = chapterById.get(targetId);

    if (!target) {
      return;
    }

    closeNavigation();
    target.node.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    setActiveChapter(target.index, true);

    if (updateHash && window.location.hash !== `#${targetId}`) {
      window.history.pushState(null, "", `#${targetId}`);
    }
  }

  function moveToRelativeChapter(direction) {
    const nextIndex = clamp(activeIndex + direction, 0, chapters.length - 1);
    const target = chapters[nextIndex];

    if (target) {
      scrollToChapter(target.id, true);
    }
  }

  function closeNavigation() {
    document.body.classList.remove("nav-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }

  function getHashTarget() {
    const id = window.location.hash.replace("#", "");
    return chapterById.get(id);
  }

  return { start };
}

function createPinnedSolutionStack({ scene, reducedMotion }) {
  const section = document.querySelector(SELECTORS.solutionsSection);
  const pinWrap = document.querySelector(SELECTORS.solutionsPinWrap);
  const cards = Array.from(document.querySelectorAll(SELECTORS.solutionCards));
  const current = document.querySelector(SELECTORS.solutionCurrent);
  const title = document.querySelector(SELECTORS.solutionTitle);
  const progressBar = document.querySelector(SELECTORS.solutionProgress);
  const desktopQuery = window.matchMedia("(min-width: 821px)");

  let isEnabled = false;
  let activeIndex = -1;
  let frame = 0;

  function start() {
    if (!section || !pinWrap || cards.length < 2) {
      return;
    }

    updateMode();
    update();

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", handleResize);

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", handleResize);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(handleResize);
    }
  }

  function handleResize() {
    updateMode();
    scheduleUpdate();
  }

  function updateMode() {
    isEnabled = desktopQuery.matches && !reducedMotion;
    section.classList.toggle("is-stack-enabled", isEnabled);

    if (!isEnabled) {
      activeIndex = -1;
      section.style.removeProperty("--solution-progress");
      progressBar?.style.removeProperty("transform");
      resetCards();
      setReadout(0, 0);
    }
  }

  function scheduleUpdate() {
    if (frame) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  }

  function update() {
    if (!isEnabled) {
      return;
    }

    const progress = getStackProgress();
    const rawIndex = progress * (cards.length - 1);
    const nextActiveIndex = clamp(Math.round(rawIndex), 0, cards.length - 1);

    section.style.setProperty("--solution-progress", progress.toFixed(4));
    progressBar?.style.setProperty("transform", `scaleX(${progress})`);

    if (nextActiveIndex !== activeIndex) {
      activeIndex = nextActiveIndex;
      setReadout(activeIndex, progress);
    }

    cards.forEach((card, index) => {
      const relative = index - rawIndex;
      const depth = Math.min(Math.abs(relative), 3);
      const isActive = Math.abs(relative) < 0.55;
      const y = clamp(relative * 44, -96, 126);
      const x = clamp(relative * 16, -28, 28);
      const scale = 1 - depth * 0.045;
      const opacity = getCardOpacity(relative, depth);
      const rotate = clamp(relative * 1.2, -2.4, 2.4);

      card.classList.toggle("is-active", isActive);
      card.classList.toggle("is-before", relative < -0.55);
      card.classList.toggle("is-after", relative > 0.55);

      gsap.set(card, {
        xPercent: -50,
        yPercent: -50,
        x,
        y,
        scale,
        opacity,
        rotate,
        zIndex: Math.round(100 - depth * 12 - Math.max(relative, 0)),
        pointerEvents: isActive ? "auto" : "none",
        transformOrigin: "50% 50%",
      });
    });

    if (progress > 0 && progress < 1) {
      scene.setProgress(0.18 + progress * 0.42);
    }
  }

  function getStackProgress() {
    const headerHeight = getHeaderHeight();
    const documentTop = pinWrap.getBoundingClientRect().top + window.scrollY;
    const start = documentTop - headerHeight;
    const distance = Math.max(1, pinWrap.offsetHeight - window.innerHeight + headerHeight);

    return clamp01((window.scrollY - start) / distance);
  }

  function getHeaderHeight() {
    const rawValue = getComputedStyle(document.documentElement).getPropertyValue("--header-height");
    const parsedValue = Number.parseFloat(rawValue);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  function getCardOpacity(relative, depth) {
    if (relative < -1.25 || relative > 2.35) {
      return 0;
    }

    if (Math.abs(relative) < 0.55) {
      return 1;
    }

    return Math.max(0.1, 1 - depth * 0.46);
  }

  function setReadout(index, progress) {
    const card = cards[index];
    const cardTitle = card?.querySelector("h3")?.textContent?.trim() || "";

    if (current) {
      current.textContent = String(index + 1).padStart(2, "0");
    }

    if (title) {
      title.textContent = cardTitle;
    }

    section.style.setProperty("--solution-progress", progress.toFixed(4));
  }

  function resetCards() {
    cards.forEach((card) => {
      card.classList.remove("is-active", "is-before", "is-after");
    });

    gsap.set(cards, {
      clearProps: "transform,opacity,zIndex,pointerEvents,rotate,scale,x,y,xPercent,yPercent",
    });
  }

  return { start };
}

function createScrollVideoScene({ reducedMotion }) {
  const video = document.querySelector(SELECTORS.sceneVideo);

  if (!video) {
    return createNoopScene();
  }

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");

  if (reducedMotion) {
    video.pause();
    video.classList.add("is-reduced-motion");

    return {
      start() {},
      setProgress() {},
    };
  }

  let duration = 0;
  let isReady = false;
  let targetProgress = 0;
  let seekFrame = 0;

  function start() {
    if (video.readyState >= 1) {
      handleLoadedMetadata();
      return;
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("error", handleVideoError, { once: true });
    video.load();
  }

  function setProgress(progress) {
    targetProgress = clamp01(progress);
    scheduleSeek();
  }

  function handleLoadedMetadata() {
    duration = Number.isFinite(video.duration) ? video.duration : 0;
    isReady = duration > 0;
    video.pause();
    scheduleSeek();
  }

  function handleVideoError() {
    video.classList.add("is-poster-only");
  }

  function scheduleSeek() {
    if (seekFrame) {
      return;
    }

    seekFrame = window.requestAnimationFrame(() => {
      seekFrame = 0;
      seekToProgress();
    });
  }

  function seekToProgress() {
    if (!isReady) {
      return;
    }

    const maxTime = Math.max(0, duration - 0.06);
    const nextTime = maxTime * targetProgress;

    if (Math.abs(video.currentTime - nextTime) < 0.045) {
      return;
    }

    try {
      video.currentTime = nextTime;
    } catch {
      video.classList.add("is-poster-only");
    }
  }

  return {
    start,
    setProgress,
  };
}

function createNoopScene() {
  return {
    start() {},
    setProgress() {},
  };
}

function isInteractiveTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("a, button, input, textarea, select, [contenteditable='true']"));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value) {
  return clamp(value, 0, 1);
}
