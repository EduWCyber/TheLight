function isMobileView() {
  return window.matchMedia("(max-width: 760px)").matches;
}

const light = document.querySelector(".light");

if (light && !isMobileView()) {
  document.addEventListener("mousemove", event => {
    light.style.left = `${event.clientX - 170}px`;
    light.style.top = `${event.clientY - 170}px`;
  });
}

function formatWaitTime(milliseconds) {
  const seconds = Math.ceil(milliseconds / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  return `${Math.ceil(seconds / 60)} min`;
}

function checkLocalRateLimit(key, { maxActions, windowMs, cooldownMs = 0 }) {
  const now = Date.now();
  const fallbackState = { timestamps: [], lastActionAt: 0 };
  let state = fallbackState;

  try {
    state = JSON.parse(window.localStorage.getItem(key)) || fallbackState;
  } catch (error) {
    state = fallbackState;
  }

  const timestamps = Array.isArray(state.timestamps)
    ? state.timestamps.filter(timestamp => now - timestamp < windowMs)
    : [];
  const lastActionAt = Number(state.lastActionAt || 0);
  const cooldownRemaining = cooldownMs - (now - lastActionAt);

  if (cooldownRemaining > 0) {
    return {
      allowed: false,
      retryAfter: cooldownRemaining
    };
  }

  if (timestamps.length >= maxActions) {
    const retryAfter = windowMs - (now - timestamps[0]);
    return {
      allowed: false,
      retryAfter
    };
  }

  timestamps.push(now);

  try {
    window.localStorage.setItem(key, JSON.stringify({
      timestamps,
      lastActionAt: now
    }));
  } catch (error) {
    // Ignore private browsing storage failures; the live request can still continue.
  }

  return {
    allowed: true,
    retryAfter: 0
  };
}

const harmfulWords = [
  "idiot", "stupid", "loser", "ugly", "dumb", "trash", "moron",
  "worthless", "pathetic", "nobody likes you", "hate you", "shut up",
  "freak", "kill yourself", "weirdo", "embarrassing", "useless",
  "bourik", "bet", "malelve", "lapat", "touni"
];

const warningWords = [
  "leave", "ignore you", "laughing at you", "go away", "annoying",
  "fake", "nobody cares", "alone", "clown", "awkward", "stop talking"
];

const supportiveWords = [
  "proud", "safe", "help", "support", "kind", "respect",
  "listen", "understand", "care", "friend", "together"
];

function getAnalyzerApiUrl() {
  const meta = document.querySelector('meta[name="analyzer-api-url"]');
  const configuredUrl = meta?.getAttribute("content")?.trim() || "";
  return configuredUrl;
}

function getHandAnalyzerApiUrl() {
  const meta = document.querySelector('meta[name="hand-analyzer-api-url"]');
  return meta?.getAttribute("content")?.trim() || `${window.location.origin}/analyze-hand`;
}

function scoreMessage(rawText) {
  const text = String(rawText || "").trim().toLowerCase();
  const compact = text.replace(/\s+/g, " ");
  const matches = [];
  let score = 8;

  harmfulWords.forEach(word => {
    if (compact.includes(word)) {
      matches.push(word);
      score += 28;
    }
  });

  warningWords.forEach(word => {
    if (compact.includes(word)) {
      matches.push(word);
      score += 14;
    }
  });

  supportiveWords.forEach(word => {
    if (compact.includes(word)) {
      score -= 8;
    }
  });

  if (text.includes("!!")) {
    score += 8;
  }

  if (text.length > 90) {
    score += 4;
  }

  score = Math.max(0, Math.min(100, score));

  let status = "Safe";
  let tone = "Neutral";
  let insight = "Supportive or neutral language reads as safe.";

  if (score >= 70) {
    status = "Harmful";
    tone = "Aggressive";
    insight = "This message uses insulting or targeted language that may be emotionally harmful.";
  } else if (score >= 35) {
    status = "Warning";
    tone = "Concerning";
    insight = "This message shows red-flag language and may need a calmer, safer response.";
  }

  return {
    score,
    status,
    tone,
    insight,
    flags: [...new Set(matches)].slice(0, 3)
  };
}

function buildSuggestedResponse(status) {
  if (status === "Harmful") {
    return "I'm not continuing this conversation.";
  }

  if (status === "Warning") {
    return "Let's pause this. I'm stepping back from this conversation for now.";
  }

  return "Thanks for checking in. Let's keep the conversation respectful.";
}

function normalizeAnalysisResult(result, originalText) {
  const safeResult = result || {};
  const predictedLabel = String(safeResult.normalized_prediction || safeResult.prediction || "").toLowerCase();
  let inferredStatus = "Safe";

  if (predictedLabel && predictedLabel !== "safe" && predictedLabel !== "neutral" && predictedLabel !== "non-toxic") {
    inferredStatus = "Harmful";
  }

  const status = ["Safe", "Warning", "Harmful"].includes(safeResult.status)
    ? safeResult.status
    : inferredStatus;
  const score = Math.max(0, Math.min(100, Number(safeResult.score ?? 0)));
  const flags = Array.isArray(safeResult.flags) ? safeResult.flags.slice(0, 3) : [];
  const numericConfidence = Number(safeResult.confidence);
  const fallbackConfidence = status === "Harmful" ? 88 : status === "Warning" ? 64 : 92;
  const confidenceValue = Number.isFinite(numericConfidence)
    ? Math.max(0, Math.min(100, numericConfidence))
    : fallbackConfidence;
  const confidenceLabel = `${Math.round(confidenceValue)}%`;

  return {
    source: safeResult.source || "local",
    text: String(originalText || ""),
    score,
    status,
    tone: safeResult.tone || (status === "Harmful" ? "Aggressive" : status === "Warning" ? "Concerning" : "Neutral"),
    insight: safeResult.insight || "Supportive or neutral language reads as safe.",
    flags,
    confidenceValue,
    confidence: confidenceLabel,
    response: safeResult.response || buildSuggestedResponse(status)
  };
}

async function analyzeMessage(rawText) {
  const text = String(rawText || "").trim();
  const apiUrl = getAnalyzerApiUrl();

  if (apiUrl) {
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error(`Analyzer request failed with status ${response.status}`);
      }

      const data = await response.json();
      return normalizeAnalysisResult(data, text);
    } catch (error) {
      console.warn("Analyzer API unavailable, falling back to local analysis.", error);
    }
  }

  const localResult = scoreMessage(text);
  return normalizeAnalysisResult(
    {
      ...localResult,
      source: "local",
      confidence: localResult.status === "Harmful" ? 88 : localResult.status === "Warning" ? 64 : 92,
      response: buildSuggestedResponse(localResult.status)
    },
    text
  );
}

function animateScoreValue(element, targetValue) {
  const currentValue = Number(element.dataset.value || 0);
  const start = performance.now();
  const duration = 500;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(currentValue + (targetValue - currentValue) * progress);
    element.textContent = `${value}%`;
    element.dataset.value = String(value);

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

function initNavbarMenu() {
  const navbar = document.querySelector(".navbar");
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");

  if (!navbar || !toggle || !menu) {
    return;
  }

  const closeMenu = () => {
    navbar.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  };

  const toggleMenu = () => {
    const isOpen = navbar.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  };

  toggle.addEventListener("click", toggleMenu);

  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      closeMenu();
    }
  });
}

function initBackToTop() {
  const topButtons = document.querySelectorAll(".back-to-top");

  if (!topButtons.length) {
    return;
  }

  const updateVisibility = () => {
    topButtons.forEach(button => {
      button.classList.toggle("visible", window.scrollY > 520);
    });
  };

  topButtons.forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  updateVisibility();
  window.addEventListener("scroll", updateVisibility, { passive: true });
}

function initSupportBeaconVisibility() {
  const beacon = document.querySelector(".support-beacon");
  const hideTargets = document.querySelectorAll("#vault, #report");

  if (!beacon || !hideTargets.length || !isMobileView()) {
    return;
  }

  const visibleTargets = new Set();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.1) {
        visibleTargets.add(entry.target);
      } else {
        visibleTargets.delete(entry.target);
      }
    });

    beacon.classList.toggle("is-soft-hidden", visibleTargets.size > 0);
  }, {
    threshold: [0, 0.1, 0.25]
  });

  hideTargets.forEach(target => observer.observe(target));
}

function initSectionRail() {
  const rail = document.querySelector(".section-rail");
  const toggle = document.querySelector(".section-rail-toggle");
  const links = document.querySelectorAll("[data-section-link]");

  if (!rail || !links.length) {
    return;
  }

  const closeRail = () => {
    rail.classList.remove("is-open");
    toggle?.setAttribute("aria-expanded", "false");
  };

  toggle?.addEventListener("click", () => {
    const isOpen = rail.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  links.forEach(link => {
    link.addEventListener("click", () => {
      closeRail();
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeRail();
    }
  });

  const targets = Array.from(links)
    .map(link => document.getElementById(link.dataset.sectionLink))
    .filter(Boolean);

  if (!targets.length) {
    return;
  }

  const visibleSections = new Map();
  const setActiveLink = id => {
    links.forEach(link => {
      const isActive = link.dataset.sectionLink === id;
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "true" : "false");
    });
  };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        visibleSections.set(entry.target.id, entry.intersectionRatio);
      } else {
        visibleSections.delete(entry.target.id);
      }
    });

    const active = [...visibleSections.entries()]
      .sort((a, b) => b[1] - a[1])[0];

    if (active) {
      setActiveLink(active[0]);
    }
  }, {
    rootMargin: "-28% 0px -55% 0px",
    threshold: [0.12, 0.24, 0.4, 0.6]
  });

  targets.forEach(target => observer.observe(target));
}

function initSubtitleRotation() {
  const subtitle = document.querySelector(".subtitle-box");

  if (!subtitle || isMobileView()) {
    return;
  }

  const phrases = [
    "Over Cyberbullying",
    "Against Bullying",
    "For Your Life",
    "For Safer Voices",
    "For Kinder Screens",
    "For Digital Respect",
    "Against Online Hate"
  ];

  let currentIndex = 0;

  window.setInterval(() => {
    subtitle.classList.add("is-changing");

    window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % phrases.length;
      subtitle.textContent = phrases[currentIndex];
      subtitle.classList.remove("is-changing");
    }, 260);
  }, 2200);
}

function initRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!revealItems.length) {
    return;
  }

  if (isMobileView()) {
    revealItems.forEach(item => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });

  revealItems.forEach(item => observer.observe(item));
}

function animateStatValue(element) {
  if (!element || element.dataset.animated === "true") {
    return;
  }

  const target = element.dataset.target || "";
  const match = target.match(/\d+/);

  if (!match) {
    element.textContent = target;
    element.dataset.animated = "true";
    return;
  }

  const finalNumber = Number(match[0]);
  const numberStart = match.index || 0;
  const numberEnd = numberStart + match[0].length;
  const prefix = target.slice(0, numberStart);
  const suffix = target.slice(numberEnd);
  const duration = 900;
  const start = performance.now();

  element.classList.add("is-animated");

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(finalNumber * eased);
    element.textContent = `${prefix}${current}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    element.textContent = target;
    element.dataset.animated = "true";
  }

  requestAnimationFrame(tick);
}

function initStatStripAnimations() {
  const statValues = document.querySelectorAll(".stat-strip-value");

  if (!statValues.length) {
    return;
  }

  if (isMobileView()) {
    statValues.forEach(value => {
      value.textContent = value.dataset.target || value.textContent;
      value.dataset.animated = "true";
    });
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }

      const delay = Number(entry.target.dataset.statOrder || 0) * 140;
      window.setTimeout(() => animateStatValue(entry.target), delay);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.45 });

  statValues.forEach((value, index) => {
    value.dataset.statOrder = String(index);
    value.textContent = "0";
    observer.observe(value);
  });
}

function animateEducationNumber(element) {
  if (!element || element.dataset.animated === "true") {
    return;
  }

  const target = Number(element.dataset.target || 0);
  const suffix = element.dataset.suffix || "";
  const duration = 1100;
  const start = performance.now();
  const decimals = Number.isInteger(target) ? 0 : 1;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = target * eased;
    element.textContent = `${current.toFixed(decimals)}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(tick);
      return;
    }

    element.textContent = `${target.toFixed(decimals)}${suffix}`;
    element.dataset.animated = "true";
  }

  requestAnimationFrame(tick);
}

function initEducationStatsAnimations() {
  const statSection = document.querySelector(".education-stats-showcase");

  if (!statSection) {
    return;
  }

  const numbers = statSection.querySelectorAll(".education-stat-number");
  const fills = statSection.querySelectorAll(".education-comparison-fill");
  const donut = statSection.querySelector(".education-donut-chart");

  if (isMobileView()) {
    numbers.forEach(number => {
      const target = Number(number.dataset.target || 0);
      const suffix = number.dataset.suffix || "";
      const decimals = Number.isInteger(target) ? 0 : 1;
      number.textContent = `${target.toFixed(decimals)}${suffix}`;
      number.dataset.animated = "true";
    });

    fills.forEach(fill => {
      fill.style.width = fill.dataset.width || "0%";
    });

    if (donut) {
      donut.classList.add("is-animated");
    }

    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        return;
      }

      numbers.forEach((number, index) => {
        window.setTimeout(() => animateEducationNumber(number), index * 120);
      });

      fills.forEach((fill, index) => {
        const width = fill.dataset.width || "0%";
        window.setTimeout(() => {
          fill.style.width = width;
        }, 180 + index * 120);
      });

      if (donut) {
        window.setTimeout(() => {
          donut.classList.add("is-animated");
        }, 160);
      }

      observer.unobserve(entry.target);
    });
  }, { threshold: 0.32 });

  observer.observe(statSection);
}

function initEducationTopicPanel() {
  const educationPage = document.body;
  const topicLinks = document.querySelectorAll("[data-topic-id]");
  const actionTopicCards = document.querySelectorAll("[data-action-topic]");
  const topicViewer = document.getElementById("educationTopicViewer");
  const emptyEl = document.getElementById("educationTopicEmpty");
  const contentEl = document.getElementById("educationTopicContent");
  const kickerEl = document.getElementById("educationTopicKicker");
  const titleEl = document.getElementById("educationTopicTitle");
  const leadEl = document.getElementById("educationTopicLead");
  const descriptionEl = document.getElementById("educationTopicDescription");
  const adviceEl = document.getElementById("educationTopicAdvice");
  const factsEl = document.getElementById("educationTopicFacts");

  if (!topicLinks.length) {
    return;
  }

  const linkMap = new Map();

  topicLinks.forEach(link => {
    const key = link.dataset.topicId;

    if (key) {
      linkMap.set(key, link);
    }
  });

  const updateTopicDetail = link => {
    if (!link || !kickerEl || !titleEl || !leadEl || !descriptionEl || !adviceEl || !factsEl || !contentEl || !emptyEl) {
      return;
    }

    const adviceTemplateId = link.dataset.topicAdviceTemplate;
    const factsTemplateId = link.dataset.topicFactsTemplate;
    const adviceTemplate = adviceTemplateId ? document.getElementById(adviceTemplateId) : null;
    const factsTemplate = factsTemplateId ? document.getElementById(factsTemplateId) : null;

    // Add fade-out animation
    contentEl.classList.remove('fade-in');
    contentEl.classList.add('fade-out');

    // Wait for animation to complete before updating content
    setTimeout(() => {
      kickerEl.textContent = link.dataset.topicKicker || "Subject focus";
      titleEl.textContent = link.dataset.topicTitle || link.textContent.trim();
      leadEl.textContent = link.dataset.topicLead || "";
      descriptionEl.textContent = link.dataset.topicDescription || "";
      adviceEl.innerHTML = adviceTemplate ? adviceTemplate.innerHTML : "";
      factsEl.innerHTML = factsTemplate ? factsTemplate.innerHTML : "";
      emptyEl.hidden = true;
      contentEl.hidden = false;

      // Add fade-in animation
      contentEl.classList.remove('fade-out');
      contentEl.classList.add('fade-in');
    }, 300);
  };

  const scrollToTopicViewer = () => {
    if (!topicViewer) {
      return;
    }

    window.setTimeout(() => {
      topicViewer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  };

  const setActiveLink = (id, shouldScroll = false) => {
    topicLinks.forEach(link => {
      const isActive = link.dataset.topicId === id;
      link.classList.toggle("active", isActive);
      link.setAttribute("aria-current", isActive ? "true" : "false");
    });

    const activeLink = linkMap.get(id);

    if (educationPage && educationPage.classList.contains("education-page")) {
      educationPage.classList.remove(
        "topic-theme-lavender",
        "topic-theme-coral",
        "topic-theme-mint",
        "topic-theme-teal",
        "topic-theme-gold"
      );

      if (activeLink?.dataset.topicTheme && activeLink.dataset.topicTheme !== "blue") {
        educationPage.classList.add(`topic-theme-${activeLink.dataset.topicTheme}`);
      }
    }

    updateTopicDetail(activeLink);

    if (shouldScroll) {
      scrollToTopicViewer();
    }
  };

  topicLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const id = link.dataset.topicId;

      if (id) {
        setActiveLink(id, true);
      }
    });
  });

  actionTopicCards.forEach(card => {
    const openLinkedTopic = () => {
      const id = card.dataset.actionTopic;

      if (id) {
        setActiveLink(id, true);
      }
    };

    card.addEventListener("click", openLinkedTopic);
    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLinkedTopic();
      }
    });
  });

  topicLinks.forEach(link => link.setAttribute("aria-current", "false"));
}

function createToolsParticles() {
  const particleHost = document.querySelector(".tools-particles");

  if (!particleHost || isMobileView()) {
    return;
  }

  const particleCount = window.innerWidth < 760 ? 16 : 28;

  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("span");
    const size = 3 + Math.random() * 5;
    const left = Math.random() * 100;
    const top = Math.random() * 100;
    const duration = 10 + Math.random() * 12;
    const delay = Math.random() * 8;

    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.left = `${left}%`;
    particle.style.top = `${top}%`;
    particle.style.animationDuration = `${duration}s`;
    particle.style.animationDelay = `${delay}s`;
    particleHost.appendChild(particle);
  }
}

function initToolsWorkspace() {
  const textarea = document.getElementById("toolsInput");
  const analyzeButton = document.getElementById("toolsAnalyzeButton");
  const sampleButton = document.getElementById("toolsSampleButton");
  const scoreEl = document.getElementById("toolsScore");
  const barEl = document.getElementById("toolsBar");
  const statusBadgeEl = document.getElementById("toolsStatus");
  const statusDetailEl = document.getElementById("toolsStatusDetail");
  const toneEl = document.getElementById("toolsTone");
  const confidenceEl = document.getElementById("toolsConfidence");
  const scoreConfidenceEl = document.getElementById("toolsScoreConfidence");
  const responseEl = document.getElementById("toolsResponse");
  const insightEl = document.getElementById("toolsInsight");
  const toolButtons = document.querySelectorAll("[data-tool-action]");

  if (!textarea || !analyzeButton || !sampleButton || !scoreEl || !barEl || !statusBadgeEl ||
      !statusDetailEl || !toneEl || !confidenceEl || !scoreConfidenceEl || !responseEl || !insightEl) {
    return;
  }

  const sampleText = "Nobody likes you. Stop talking in our group chat.";
  const analyzerRateLimit = {
    maxActions: 8,
    windowMs: 60000,
    cooldownMs: 4500
  };

  const setReadyState = () => {
    statusBadgeEl.textContent = "Ready";
    statusBadgeEl.className = "ready";
    statusDetailEl.textContent = "Waiting";
    toneEl.textContent = "Not analyzed";
    confidenceEl.textContent = "--";
    scoreConfidenceEl.textContent = "--";
    responseEl.textContent = "Click Analyze Message when you are ready.";
    insightEl.textContent = "The sample is loaded, but it will not be analyzed until you press the button.";
    barEl.className = "progress-fill ready";
    barEl.style.width = "0%";
    scoreEl.textContent = "0%";
    scoreEl.dataset.value = "0";
  };

  const startAnalyzeCountdown = () => {
    const totalSeconds = 4;
    const start = performance.now();

    analyzeButton.classList.add("is-analyzing");
    analyzeButton.setAttribute("aria-busy", "true");

    const updateLabel = () => {
      const elapsed = (performance.now() - start) / 1000;
      const remaining = totalSeconds - elapsed;
      analyzeButton.textContent = remaining > 0
        ? `Analyzing ${remaining.toFixed(1)}s`
        : "Finalizing...";
    };

    updateLabel();
    const timer = window.setInterval(updateLabel, 120);

    return () => {
      window.clearInterval(timer);
      analyzeButton.classList.remove("is-analyzing");
      analyzeButton.removeAttribute("aria-busy");
      analyzeButton.textContent = "Analyze Message";
    };
  };

  const applyResult = profile => {
    statusBadgeEl.textContent = profile.status;
    statusBadgeEl.className = profile.status.toLowerCase();
    statusDetailEl.textContent = profile.status;
    toneEl.textContent = profile.tone;
    confidenceEl.textContent = profile.confidence;
    scoreConfidenceEl.textContent = profile.confidence;
    responseEl.textContent = profile.response;
    insightEl.textContent = profile.insight;
    barEl.className = `progress-fill ${profile.status.toLowerCase()}`;
    barEl.style.width = `${profile.score}%`;
    animateScoreValue(scoreEl, profile.score);
  };

  const runAnalysis = async () => {
    const text = textarea.value.trim();

    if (!text) {
      setReadyState();
      responseEl.textContent = "Paste a message before analyzing.";
      insightEl.textContent = "Empty messages are not sent to the analyzer.";
      return;
    }

    if (text.length > 1500) {
      statusBadgeEl.textContent = "Paused";
      statusBadgeEl.className = "warning";
      statusDetailEl.textContent = "Too long";
      responseEl.textContent = "Shorten the message before analyzing.";
      insightEl.textContent = "For safer use, the analyzer accepts messages up to 1,500 characters.";
      return;
    }

    const limit = checkLocalRateLimit("theLightAnalyzerRateLimit", analyzerRateLimit);

    if (!limit.allowed) {
      const wait = formatWaitTime(limit.retryAfter);
      statusBadgeEl.textContent = "Slow down";
      statusBadgeEl.className = "warning";
      statusDetailEl.textContent = "Rate limited";
      toneEl.textContent = "Anti-spam pause";
      confidenceEl.textContent = "--";
      scoreConfidenceEl.textContent = "--";
      responseEl.textContent = `Please wait ${wait} before analyzing again.`;
      insightEl.textContent = "This pause protects the analyzer from repeated rapid requests.";
      return;
    }

    analyzeButton.disabled = true;
    sampleButton.disabled = true;
    const stopCountdown = startAnalyzeCountdown();

    try {
      const profile = await analyzeMessage(text);
      applyResult(profile);
    } finally {
      analyzeButton.disabled = false;
      sampleButton.disabled = false;
      stopCountdown();
    }
  };

  analyzeButton.addEventListener("click", () => {
    void runAnalysis();
  });
  sampleButton.addEventListener("click", () => {
    textarea.value = sampleText;
    setReadyState();
  });

  toolButtons.forEach(button => {
    button.addEventListener("click", () => {
      const action = button.dataset.toolAction;
      const output = document.getElementById(`toolOutput${action.charAt(0).toUpperCase()}${action.slice(1)}`);

      if (!output) {
        return;
      }

      // Default behavior for all tools (including report)
      output.classList.toggle("visible");
    });
  });

  // Request Support form validation & submission
  const supportForm = document.getElementById("supportForm");
  const screenshotInput = document.getElementById("urgentHelpScreenshots");
  const screenshotStatus = document.getElementById("screenshotFileStatus");
  const supportStatus = document.getElementById("supportFormStatus");
  const supportSubmitButton = document.getElementById("supportSubmitButton");
  const supportRateLimit = {
    maxActions: 3,
    windowMs: 10 * 60 * 1000,
    cooldownMs: 60 * 1000
  };

  const setSupportMessage = (message, type = "info") => {
    if (!supportStatus) {
      return;
    }

    supportStatus.textContent = message;
    supportStatus.dataset.type = type;
  };

  const validateScreenshots = () => {
    const files = Array.from(screenshotInput?.files || []);
    const maxFiles = 5;
    const maxFileSize = 8 * 1024 * 1024;
    const maxTotalSize = 20 * 1024 * 1024;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (files.length > maxFiles) {
      return `Attach ${maxFiles} screenshots or fewer.`;
    }

    if (files.some(file => file.size > maxFileSize)) {
      return "Each screenshot must be under 8 MB.";
    }

    if (totalSize > maxTotalSize) {
      return "All screenshots together must be under 20 MB.";
    }

    return "";
  };

  if (screenshotInput && screenshotStatus) {
    screenshotInput.addEventListener("change", () => {
      const count = screenshotInput.files?.length || 0;
      const screenshotError = validateScreenshots();
      screenshotStatus.textContent = count === 0
        ? "No screenshots selected"
        : `${count} screenshot${count === 1 ? "" : "s"} selected`;

      if (screenshotError) {
        setSupportMessage(screenshotError, "warning");
      }
    });
  }

  if (supportForm) {
    supportForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("urgentHelpName");
      const email = document.getElementById("urgentHelpEmail");
      const message = document.getElementById("urgentHelpMessage");
      setSupportMessage("");

      // Clear previous error styles
      [name, email, message].forEach(field => {
        field.style.borderColor = "";
        field.style.boxShadow = "";
      });

      let isValid = true;
      let firstErrorField = null;

      // Check all fields are filled
      if (!name.value.trim()) {
        name.style.borderColor = "#f87171";
        name.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
        isValid = false;
        firstErrorField = firstErrorField || name;
      }

      if (!email.value.trim()) {
        email.style.borderColor = "#f87171";
        email.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
        isValid = false;
        firstErrorField = firstErrorField || email;
      }

      if (!message.value.trim()) {
        message.style.borderColor = "#f87171";
        message.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
        isValid = false;
        firstErrorField = firstErrorField || message;
      }

      // Simple email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email.value.trim() && !emailRegex.test(email.value.trim())) {
        email.style.borderColor = "#f87171";
        email.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
        isValid = false;
        firstErrorField = firstErrorField || email;
        alert("Please enter a valid email address.");
        return;
      }

      if (!isValid) {
        alert("Please fill in all required fields.");
        firstErrorField?.focus();
        return;
      }

      if (message.value.trim().length > 2500) {
        message.style.borderColor = "#f87171";
        message.style.boxShadow = "0 0 0 3px rgba(248, 113, 113, 0.2)";
        setSupportMessage("Please shorten the report to 2,500 characters or fewer.", "warning");
        message.focus();
        return;
      }

      const screenshotError = validateScreenshots();

      if (screenshotError) {
        setSupportMessage(screenshotError, "warning");
        screenshotInput?.focus();
        return;
      }

      const limit = checkLocalRateLimit("theLightSupportFormRateLimit", supportRateLimit);

      if (!limit.allowed) {
        setSupportMessage(`Please wait ${formatWaitTime(limit.retryAfter)} before sending another support request.`, "warning");
        return;
      }

      if (supportSubmitButton) {
        supportSubmitButton.disabled = true;
        supportSubmitButton.textContent = "Sending...";
      }

      setSupportMessage("Sending your support request...", "info");

      // Submit to Formspree
      fetch("https://formspree.io/f/xbdpgoda", {
        method: "POST",
        headers: {
          "Accept": "application/json"
        },
        body: new FormData(supportForm)
      })
      .then(response => {
        if (response.ok) {
          alert("Support request submitted successfully!");
          supportForm.reset();
          screenshotStatus.textContent = "No screenshots selected";
          setSupportMessage("Support request sent. Thank you for reporting it clearly.", "success");
        } else {
          setSupportMessage("There was an error submitting your request. Please try again.", "error");
          alert("There was an error submitting your request. Please try again.");
        }
      })
      .catch(error => {
        setSupportMessage("There was an error submitting your request. Please try again.", "error");
        alert("There was an error submitting your request. Please try again.");
        console.error("Form submission error:", error);
      })
      .finally(() => {
        if (supportSubmitButton) {
          supportSubmitButton.disabled = false;
          supportSubmitButton.textContent = "Request Support";
        }
      });
    });
  }

  textarea.addEventListener("input", () => {
    setReadyState();
  });

  textarea.value = sampleText;
  setReadyState();
  createToolsParticles();
}

function initHandAnalyzerPanel() {
  const statusEl = document.getElementById("handAnalyzerStatus");
  const insightEl = document.getElementById("handAnalyzerInsight");
  const checkButton = document.getElementById("handBackendCheckButton");
  const startButton = document.getElementById("handCameraStartButton");
  const stopButton = document.getElementById("handCameraStopButton");
  const video = document.getElementById("handAnalyzerVideo");
  const canvas = document.getElementById("handAnalyzerCanvas");
  const placeholder = document.getElementById("handAnalyzerPlaceholder");
  const labelEl = document.getElementById("handAnalyzerLabel");
  const confidenceEl = document.getElementById("handAnalyzerConfidence");

  if (!statusEl || !insightEl || !checkButton || !startButton || !stopButton || !video || !canvas || !labelEl || !confidenceEl) {
    return;
  }

  const context = canvas.getContext("2d");
  let mediaStream = null;
  let hands = null;
  let camera = null;
  let lastPredictionAt = 0;
  let predictionInFlight = false;
  const predictionInterval = 650;

  const setStatus = (label, className, message) => {
    statusEl.textContent = label;
    statusEl.className = className;
    insightEl.textContent = message;
  };

  const setPrediction = (label, confidence = 0) => {
    const normalizedLabel = String(label || "Waiting");
    const confidenceValue = Math.max(0, Math.min(100, Number(confidence) || 0));
    labelEl.textContent = normalizedLabel;
    confidenceEl.textContent = `${Math.round(confidenceValue)}%`;
    labelEl.classList.toggle("is-punch", normalizedLabel.toLowerCase() === "punch");
  };

  const drawLandmarks = landmarks => {
    if (!context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = "rgba(50, 210, 255, 0.9)";
    context.strokeStyle = "rgba(255, 255, 255, 0.65)";
    context.lineWidth = 2;

    landmarks.forEach(point => {
      context.beginPath();
      context.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2);
      context.fill();
    });
  };

  const sendPrediction = async landmarks => {
    const now = Date.now();

    if (predictionInFlight || now - lastPredictionAt < predictionInterval) {
      return;
    }

    predictionInFlight = true;
    lastPredictionAt = now;

    try {
      const response = await fetch(getHandAnalyzerApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          landmarks: landmarks.flatMap(point => [point.x, point.y, point.z])
        })
      });

      if (!response.ok) {
        throw new Error(`Hand analyzer request failed with status ${response.status}`);
      }

      const result = await response.json();
      setPrediction(result.label || result.prediction, result.confidence);
      setStatus(
        String(result.label || result.prediction || "").toLowerCase() === "punch" ? "Punch detected" : "Hand detected",
        String(result.label || result.prediction || "").toLowerCase() === "punch" ? "harmful" : "safe",
        result.message || "The Render hand model analyzed the current hand pose."
      );
    } catch (error) {
      setStatus("Backend issue", "warning", "Camera is running, but the Render hand analyzer did not return a prediction.");
    } finally {
      predictionInFlight = false;
    }
  };

  const stopCamera = async () => {
    if (camera?.stop) {
      camera.stop();
    }

    if (hands?.close) {
      await hands.close();
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }

    camera = null;
    hands = null;
    mediaStream = null;
    video.srcObject = null;
    startButton.disabled = false;
    stopButton.disabled = true;
    placeholder?.removeAttribute("hidden");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    setStatus("Camera ready", "ready", "Start the webcam to scan for an idle hand or punch state.");
    setPrediction("Waiting", 0);
  };

  const startCamera = async () => {
    if (!window.Hands || !window.Camera) {
      setStatus("Library missing", "warning", "MediaPipe Hands did not load. Check your internet connection and refresh.");
      return;
    }

    startButton.disabled = true;
    startButton.textContent = "Starting...";
    setStatus("Starting camera", "ready", "The browser is asking for webcam permission.");

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      video.srcObject = mediaStream;
      await video.play();

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      hands = new window.Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.68,
        minTrackingConfidence: 0.65
      });

      hands.onResults(results => {
        const landmarks = results.multiHandLandmarks?.[0];

        if (!landmarks) {
          context?.clearRect(0, 0, canvas.width, canvas.height);
          setStatus("Searching", "ready", "Show one hand clearly in the camera frame.");
          setPrediction("No hand", 0);
          return;
        }

        placeholder?.setAttribute("hidden", "");
        drawLandmarks(landmarks);
        sendPrediction(landmarks);
      });

      camera = new window.Camera(video, {
        onFrame: async () => {
          if (hands) {
            await hands.send({ image: video });
          }
        },
        width: 640,
        height: 480
      });

      await camera.start();
      stopButton.disabled = false;
      setStatus("Camera live", "safe", "Show your hand to the webcam. The model will classify idle or punch.");
    } catch (error) {
      await stopCamera();
      setStatus("Camera blocked", "harmful", "The browser could not access the webcam. Allow camera permission and try again.");
    } finally {
      startButton.textContent = "Start Camera";
    }
  };

  startButton.addEventListener("click", startCamera);
  stopButton.addEventListener("click", stopCamera);

  checkButton.addEventListener("click", async () => {
    const apiUrl = getHandAnalyzerApiUrl();

    if (!apiUrl) {
      setStatus(
        "Endpoint needed",
        "warning",
        "Add your Render hand analyzer URL to the hand-analyzer-api-url meta tag before checking the backend."
      );
      return;
    }

    checkButton.disabled = true;
    checkButton.textContent = "Checking...";
    setStatus("Checking", "ready", "Contacting the Render hand analyzer backend.");

    try {
      const response = await fetch(apiUrl, { method: "GET" });

      if (response.ok) {
        setStatus("Backend online", "safe", "Render responded successfully. The hand analyzer backend is reachable.");
      } else {
        setStatus("Backend replied", "warning", `Render responded with status ${response.status}.`);
      }
    } catch (error) {
      setStatus("Offline", "harmful", "The browser could not reach the Render hand analyzer endpoint.");
    } finally {
      checkButton.disabled = false;
      checkButton.textContent = "Check Backend";
    }
  });

  window.addEventListener("pagehide", stopCamera);
}

window.addEventListener("DOMContentLoaded", () => {
  initNavbarMenu();
  initBackToTop();
  initSupportBeaconVisibility();
  initSectionRail();
  initSubtitleRotation();
  initRevealAnimations();
  initStatStripAnimations();
  initEducationStatsAnimations();
  initEducationTopicPanel();
  initToolsWorkspace();
  initHandAnalyzerPanel();
});
