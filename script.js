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
    analyzeButton.disabled = true;
    sampleButton.disabled = true;
    analyzeButton.textContent = "Analyzing...";

    try {
      const profile = await analyzeMessage(textarea.value);
      applyResult(profile);
    } finally {
      analyzeButton.disabled = false;
      sampleButton.disabled = false;
      analyzeButton.textContent = "Analyze Message";
    }
  };

  analyzeButton.addEventListener("click", () => {
    void runAnalysis();
  });
  sampleButton.addEventListener("click", () => {
    textarea.value = sampleText;
    void runAnalysis();
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

  if (screenshotInput && screenshotStatus) {
    screenshotInput.addEventListener("change", () => {
      const count = screenshotInput.files?.length || 0;
      screenshotStatus.textContent = count === 0
        ? "No screenshots selected"
        : `${count} screenshot${count === 1 ? "" : "s"} selected`;
    });
  }

  if (supportForm) {
    supportForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const name = document.getElementById("urgentHelpName");
      const email = document.getElementById("urgentHelpEmail");
      const message = document.getElementById("urgentHelpMessage");

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
        } else {
          alert("There was an error submitting your request. Please try again.");
        }
      })
      .catch(error => {
        alert("There was an error submitting your request. Please try again.");
        console.error("Form submission error:", error);
      });
    });
  }

  textarea.addEventListener("input", () => {
    if (!textarea.value.trim()) {
      scoreEl.textContent = "0%";
      scoreEl.dataset.value = "0";
      barEl.style.width = "0%";
    }
  });

  textarea.value = sampleText;
  void runAnalysis();
  createToolsParticles();
}

window.addEventListener("DOMContentLoaded", () => {
  initNavbarMenu();
  initBackToTop();
  initSubtitleRotation();
  initRevealAnimations();
  initStatStripAnimations();
  initEducationStatsAnimations();
  initEducationTopicPanel();
  initToolsWorkspace();
});
