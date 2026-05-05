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

function updateDemo(message) {
  const statusEl = document.getElementById("demoStatus");
  const scoreEl = document.getElementById("demoScore");
  const barEl = document.getElementById("demoBar");
  const insightEl = document.getElementById("demoInsight");
  const toneEl = document.getElementById("demoTone");
  const flagsEl = document.getElementById("demoFlags");

  if (!statusEl || !scoreEl || !barEl || !insightEl || !toneEl || !flagsEl) {
    return;
  }

  const analysis = scoreMessage(message);
  const statusClass = analysis.status.toLowerCase();

  statusEl.textContent = analysis.status;
  statusEl.className = `status-pill ${statusClass}`;
  barEl.className = `progress-fill ${statusClass}`;
  barEl.style.width = `${analysis.score}%`;
  insightEl.textContent = analysis.insight;
  toneEl.textContent = analysis.tone;
  flagsEl.textContent = analysis.flags.length ? analysis.flags.join(", ") : "None";

  animateScoreValue(scoreEl, analysis.score);
}

function initDemo() {
  const demoInput = document.getElementById("demoMessage");
  const demoButton = document.getElementById("demoAnalyze");

  if (!demoInput || !demoButton) {
    return;
  }

  const runDemo = () => updateDemo(demoInput.value);

  demoButton.addEventListener("click", runDemo);
  demoInput.addEventListener("input", runDemo);
  updateDemo(demoInput.value || "You are so weird and nobody likes you");
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

  const setActiveLink = id => {
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
  };

  topicLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const id = link.dataset.topicId;

      if (id) {
        setActiveLink(id);
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
  const responseEl = document.getElementById("toolsResponse");
  const insightEl = document.getElementById("toolsInsight");
  const toolButtons = document.querySelectorAll("[data-tool-action]");

  if (!textarea || !analyzeButton || !sampleButton || !scoreEl || !barEl || !statusBadgeEl ||
      !statusDetailEl || !toneEl || !confidenceEl || !responseEl || !insightEl) {
    return;
  }

  const sampleText = "Nobody likes you. Stop talking in our group chat.";

  const resultProfiles = {
    Safe: {
      score: 16,
      tone: "Supportive / Neutral",
      confidence: "Moderate",
      response: "Thanks for checking in. Let's keep the conversation respectful.",
      insight: "The message reads as calm or supportive, with no strong harmful cues."
    },
    Warning: {
      score: 54,
      tone: "Provoking / Dismissive",
      confidence: "Medium",
      response: "Let's pause this. I'm stepping back from this conversation for now.",
      insight: "The wording carries pressure or dismissal, so a calmer reply and distance may help."
    },
    Harmful: {
      score: 82,
      tone: "Insult / Exclusion",
      confidence: "High",
      response: "I'm not continuing this conversation.",
      insight: "This message contains insulting and exclusionary cues, so a brief boundary-setting reply is safer than engaging."
    }
  };

  const applyResult = profile => {
    statusBadgeEl.textContent = profile.status;
    statusBadgeEl.className = profile.status.toLowerCase();
    statusDetailEl.textContent = profile.status;
    toneEl.textContent = profile.tone;
    confidenceEl.textContent = profile.confidence;
    responseEl.textContent = profile.response;
    insightEl.textContent = profile.insight;
    barEl.className = `progress-fill ${profile.status.toLowerCase()}`;
    barEl.style.width = `${profile.score}%`;
    animateScoreValue(scoreEl, profile.score);
  };

  const buildProfile = text => {
    const value = text.trim();

    if (!value) {
      return { status: "Harmful", ...resultProfiles.Harmful };
    }

    const analysis = scoreMessage(value);
    const profile = resultProfiles[analysis.status];
    return { status: analysis.status, ...profile };
  };

  const runAnalysis = () => {
    applyResult(buildProfile(textarea.value));
  };

  analyzeButton.addEventListener("click", runAnalysis);
  sampleButton.addEventListener("click", () => {
    textarea.value = sampleText;
    runAnalysis();
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
  runAnalysis();
  createToolsParticles();
}

window.addEventListener("DOMContentLoaded", () => {
  initNavbarMenu();
  initSubtitleRotation();
  initDemo();
  initRevealAnimations();
  initStatStripAnimations();
  initEducationStatsAnimations();
  initEducationTopicPanel();
  initToolsWorkspace();
});
