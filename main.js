const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const onReady = (fn) => {
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", fn, { once: true });
		return;
	}
	fn();
};

const onIdle = (fn, { timeout = 1200 } = {}) => {
	if (typeof window === "undefined") return;
	if ("requestIdleCallback" in window) {
		window.requestIdleCallback(fn, { timeout });
		return;
	}
	setTimeout(fn, 0);
};

onReady(() => {
	// Lock pinch/zoom on touch devices (backup to viewport settings).
	// Note: This reduces accessibility for users who rely on zoom.
	const isTouchDevice =
		("ontouchstart" in window) || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
	if (isTouchDevice) {
		let lastTouchEnd = 0;
		const doubleTapWindowMs = 340;

		const shouldAllowGestureTarget = (target) => {
			if (!(target instanceof Element)) return false;
			return Boolean(
				target.closest(
					"input, textarea, select, [contenteditable='true']"
				)
			);
		};

		document.addEventListener(
			"touchstart",
			(e) => {
				if (e.touches && e.touches.length > 1 && !shouldAllowGestureTarget(e.target)) {
					e.preventDefault();
				}
			},
			{ passive: false }
		);

		document.addEventListener(
			"touchmove",
			(e) => {
				if (e.touches && e.touches.length > 1 && !shouldAllowGestureTarget(e.target)) {
					e.preventDefault();
				}
			},
			{ passive: false }
		);

		// Block double-tap to zoom except on form controls
		document.addEventListener(
			"touchend",
			(e) => {
				if (shouldAllowGestureTarget(e.target)) return;
				const now = Date.now();
				if (now - lastTouchEnd <= doubleTapWindowMs) {
					e.preventDefault();
				}
				lastTouchEnd = now;
			},
			{ passive: false }
		);

		// iOS Safari gesture events
		for (const name of ["gesturestart", "gesturechange", "gestureend"]) {
			document.addEventListener(
				name,
				(e) => {
					if (!shouldAllowGestureTarget(e.target)) e.preventDefault();
				},
				{ passive: false }
			);
		}
	}

	const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
	const getStoredLitePreference = () => {
		try {
			const value = localStorage.getItem("site-lite-mode");
			if (value === "1") return true;
			if (value === "0") return false;
			return null;
		} catch {
			return null;
		}
	};

	const shouldAutoEnableLite = () => {
		if (prefersReducedMotion) return true;
		const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
		if (connection?.saveData) return true;
		if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory > 0) {
			if (navigator.deviceMemory <= 4) return true;
		}
		if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency > 0) {
			if (navigator.hardwareConcurrency <= 4) return true;
		}
		return false;
	};

	const applyLiteMode = (enabled) => {
		document.documentElement.classList.toggle("is-lite", enabled);
	};

	let isLiteMode = getStoredLitePreference();
	if (isLiteMode === null) isLiteMode = shouldAutoEnableLite();
	applyLiteMode(Boolean(isLiteMode));

	let supportsFinePointer =
		(window.matchMedia?.("(pointer:fine) and (hover:hover)")?.matches ?? false) && !isLiteMode;

	const getGitHubPagesBasePath = () => {
		const isGitHubPages = location.hostname.endsWith("github.io");
		if (!isGitHubPages) return "";
		const firstPathSegment = location.pathname.split("/").filter(Boolean)[0];
		return firstPathSegment ? `/${firstPathSegment}` : "";
	};

	const prefixRootRelativeLinks = () => {
		const basePath = getGitHubPagesBasePath();
		if (!basePath) return;
		for (const anchor of document.querySelectorAll('a[href^="/"]')) {
			const href = anchor.getAttribute("href");
			if (!href) continue;
			if (href === basePath || href.startsWith(`${basePath}/`)) continue;
			anchor.setAttribute("href", `${basePath}${href}`);
		}
	};

	const year = document.getElementById("year");
	if (year) year.textContent = String(new Date().getFullYear());

	const topBar = document.querySelector(".top");
	let topBarLastY = window.scrollY;

	prefixRootRelativeLinks();

	// Lite mode toggle (injected into header so all pages get it)
	const mountLiteToggle = () => {
		const headerInner = document.querySelector(".top__inner");
		if (!headerInner) return;
		if (headerInner.querySelector(".lite-toggle")) return;

		const button = document.createElement("button");
		button.type = "button";
		button.className = "button button--ghost lite-toggle";
		button.setAttribute("aria-pressed", String(Boolean(isLiteMode)));
		button.title = "Toggle Lite mode (reduces motion/effects)";

		const label = () => (isLiteMode ? "Lite: On" : "Lite: Off");
		button.textContent = label();

		button.addEventListener(
			"click",
			() => {
				isLiteMode = !isLiteMode;
				applyLiteMode(isLiteMode);
				button.setAttribute("aria-pressed", String(Boolean(isLiteMode)));
				button.textContent = label();
				supportsFinePointer =
					(window.matchMedia?.("(pointer:fine) and (hover:hover)")?.matches ?? false) &&
					!isLiteMode;

				if (isLiteMode) {
					// Snap any interactive motion back to rest.
					for (const el of document.querySelectorAll("[data-magnetic]")) {
						el.style.setProperty("--magX", "0px");
						el.style.setProperty("--magY", "0px");
						el.style.setProperty("--btnLift", "0px");
					}
					for (const card of document.querySelectorAll(".card")) {
						card.style.setProperty("--rx", "0deg");
						card.style.setProperty("--ry", "0deg");
					}
				}

				try {
					localStorage.setItem("site-lite-mode", isLiteMode ? "1" : "0");
				} catch {
					// ignore
				}
				// Recompute scroll/parallax vars immediately after switching
				requestScrollUpdate?.();
			},
			{ passive: true }
		);

		headerInner.appendChild(button);
	};
	mountLiteToggle();

	// Scroll reveal choreography
	const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("is-inview");
				io.unobserve(entry.target);
			}
		},
		{ root: null, threshold: 0.14, rootMargin: "0px 0px -8% 0px" }
	);

	revealItems.forEach((el, index) => {
		el.style.transitionDelay = `${Math.min(260, index * 45)}ms`;
		io.observe(el);
	});

	// Smooth in-page navigation (more premium than native smooth scroll)
	const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
	const smoothScrollTo = (targetY, duration = 720) => {
		if (prefersReducedMotion) {
			window.scrollTo(0, targetY);
			return;
		}
		const startY = window.scrollY;
		const delta = targetY - startY;
		const start = performance.now();
		const tick = (now) => {
			const t = clamp((now - start) / duration, 0, 1);
			window.scrollTo(0, startY + delta * easeOutExpo(t));
			if (t < 1) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	};

	document.addEventListener("click", (e) => {
		const a = e.target?.closest?.('a[href^="#"]');
		if (!a) return;
		const href = a.getAttribute("href");
		if (!href || href === "#") return;
		const id = href.slice(1);
		const el = document.getElementById(id);
		if (!el) return;
		e.preventDefault();
		const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 88);
		smoothScrollTo(y);
		history.pushState(null, "", href);
	});

	const root = document.documentElement;
	// Pointer spotlight + micro parallax (defer heavy transforms to idle)
	onIdle(() => {
		if (!supportsFinePointer) return;
		const mesh = document.querySelector(".bg__mesh");
		const orbs = document.querySelector(".bg__orbs");
		let px = 0;
		let py = 0;
		let pointerRaf = 0;

		const applyPointerParallax = () => {
			pointerRaf = 0;
			if (mesh) {
				mesh.style.transform = `translate3d(${px * -14}px, ${py * -12}px, 0)`;
			}
			if (orbs) {
				orbs.style.transform = `translate3d(${px * 12}px, ${py * 10}px, 0)`;
			}
		};

		const onMove = (event) => {
			if (isLiteMode) return;
			const x = event.clientX / window.innerWidth - 0.5;
			const y = event.clientY / window.innerHeight - 0.5;
			px = x;
			py = y;

			const sx = (event.clientX / window.innerWidth) * 100;
			const sy = (event.clientY / window.innerHeight) * 100;
			root.style.setProperty("--sx", `${sx}%`);
			root.style.setProperty("--sy", `${sy}%`);

			if (!prefersReducedMotion && !pointerRaf) {
				pointerRaf = requestAnimationFrame(applyPointerParallax);
			}
		};

		window.addEventListener("pointermove", onMove, { passive: true });
		if (!prefersReducedMotion) applyPointerParallax();
	});

	// Scroll progress + scroll-speed blur (run work on rAF; avoid continuous loops)
	let lastScrollY = window.scrollY;

	const enableParallax = !prefersReducedMotion && !isLiteMode;
	const visibleParallaxItems = new Set();
	const allParallaxItems = Array.from(document.querySelectorAll("[data-parallax]"));
	if (enableParallax && "IntersectionObserver" in window) {
		const parallaxIo = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visibleParallaxItems.add(entry.target);
					else visibleParallaxItems.delete(entry.target);
				}
			},
			{ root: null, threshold: 0, rootMargin: "15% 0px 15% 0px" }
		);
		for (const el of allParallaxItems) {
			const factor = Number(el.getAttribute("data-parallax") || "0") || 0;
			if (factor <= 0) continue;
			parallaxIo.observe(el);
		}
	} else if (enableParallax) {
		for (const el of allParallaxItems) {
			visibleParallaxItems.add(el);
		}
	}

	let parallaxRaf = 0;
	const updateParallax = () => {
		parallaxRaf = 0;
		for (const el of visibleParallaxItems) {
			const factor = Number(el.getAttribute("data-parallax") || "0") || 0;
			if (factor <= 0) continue;
			const r = el.getBoundingClientRect();
			const center = r.top + r.height / 2;
			const dist = (center - window.innerHeight / 2) / window.innerHeight;
			const px = clamp(-dist * factor * 110, -34, 34);
			el.style.setProperty("--parY", `${px.toFixed(2)}px`);
		}
	};
	const requestParallax = () => {
		if (!enableParallax) return;
		if (parallaxRaf) return;
		parallaxRaf = requestAnimationFrame(updateParallax);
	};

	let scrollRaf = 0;
	const updateScrollVars = () => {
		scrollRaf = 0;

		if (topBar) {
			const y = window.scrollY;
			const delta = y - topBarLastY;
			topBarLastY = y;

			// Fade away while scrolling down; reappear when scrolling up or at top.
			if (y <= 0) {
				topBar.classList.remove("is-hidden");
			} else if (delta > 0) {
				topBar.classList.add("is-hidden");
			} else if (delta < 0) {
				topBar.classList.remove("is-hidden");
			}
		}

		const doc = document.documentElement;
		const max = Math.max(1, doc.scrollHeight - window.innerHeight);
		const progress = window.scrollY / max;

		const dy = Math.abs(window.scrollY - lastScrollY);
		lastScrollY = window.scrollY;
		const blurPx = Math.min(10, dy / 18);

		// Hero wordmark: restrained but alive
		const heroDrift = clamp(window.scrollY / window.innerHeight, 0, 1.4);
		const heroY = heroDrift * 22;
		const heroSkew = clamp(-6 + heroDrift * 6, -6, 1);

		root.style.setProperty("--scroll", String(progress));
		root.style.setProperty(
			"--scrollBlur",
			prefersReducedMotion || isLiteMode ? "0px" : `${blurPx.toFixed(2)}px`
		);
		root.style.setProperty("--heroWordmarkY", `${heroY.toFixed(2)}px`);
		root.style.setProperty("--heroWordmarkSkew", `${heroSkew.toFixed(2)}deg`);
		requestParallax();
	};
	const requestScrollUpdate = () => {
		if (scrollRaf) return;
		scrollRaf = requestAnimationFrame(updateScrollVars);
	};
	window.addEventListener("scroll", requestScrollUpdate, { passive: true });
	window.addEventListener("resize", requestScrollUpdate, { passive: true });
	requestScrollUpdate();

	// Hover/pointer effects (defer to idle to reduce initial load work)
	onIdle(() => {
		if (!supportsFinePointer) return;
		// Card hotspot gradient follows cursor
		const cards = Array.from(document.querySelectorAll(".card"));
		cards.forEach((card) => {
			card.addEventListener(
				"pointermove",
				(e) => {
					if (isLiteMode) return;
					const rect = card.getBoundingClientRect();
					const mx = ((e.clientX - rect.left) / rect.width) * 100;
					const my = ((e.clientY - rect.top) / rect.height) * 100;
					card.style.setProperty("--mx", `${mx}%`);
					card.style.setProperty("--my", `${my}%`);

					if (!prefersReducedMotion) {
						const cx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
						const cy = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
						card.style.setProperty("--ry", `${clamp(cx * 10, -10, 10)}deg`);
						card.style.setProperty("--rx", `${clamp(cy * -8, -8, 8)}deg`);
					}
				},
				{ passive: true }
			);
			card.addEventListener(
				"pointerleave",
				() => {
					card.style.setProperty("--rx", "0deg");
					card.style.setProperty("--ry", "0deg");
				},
				{ passive: true }
			);
		});

		// Magnetic buttons
		const magnetic = Array.from(document.querySelectorAll("[data-magnetic]"));
		if (!prefersReducedMotion) {
			magnetic.forEach((el) => {
				let mx = 0;
				let my = 0;
				let tx = 0;
				let ty = 0;
				let magRaf = 0;

				const magTick = () => {
					magRaf = 0;
					tx += (mx - tx) * 0.14;
					ty += (my - ty) * 0.14;
					el.style.setProperty("--magX", `${(tx * 10).toFixed(2)}px`);
					el.style.setProperty("--magY", `${(ty * 8).toFixed(2)}px`);

					const stillAnimating = Math.abs(mx - tx) > 0.002 || Math.abs(my - ty) > 0.002;
					if (stillAnimating) {
						magRaf = requestAnimationFrame(magTick);
					}
				};

				const onMagMove = (e) => {
					if (isLiteMode) return;
					const r = el.getBoundingClientRect();
					mx = (e.clientX - (r.left + r.width / 2)) / r.width;
					my = (e.clientY - (r.top + r.height / 2)) / r.height;
					if (!magRaf) magRaf = requestAnimationFrame(magTick);
				};

				el.addEventListener("pointermove", onMagMove, { passive: true });
				el.addEventListener(
					"pointerleave",
					() => {
						mx = 0;
						my = 0;
						if (!magRaf) magRaf = requestAnimationFrame(magTick);
					},
					{ passive: true }
				);
			});
		}

		// Subtle tilt on the hero panel
		const tiltTarget = document.querySelector("[data-tilt]");
		if (tiltTarget) {
			let tx = 0;
			let ty = 0;
			let cx = 0;
			let cy = 0;
			let tiltRaf = 0;

			const tiltTick = () => {
				tiltRaf = 0;
				tx += (cx - tx) * 0.08;
				ty += (cy - ty) * 0.08;
				const rx = clamp(ty * -10, -10, 10);
				const ry = clamp(tx * 12, -12, 12);
				tiltTarget.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;

				const stillAnimating = Math.abs(cx - tx) > 0.002 || Math.abs(cy - ty) > 0.002;
				if (stillAnimating) {
					tiltRaf = requestAnimationFrame(tiltTick);
				}
			};

			const onTiltMove = (e) => {
				const r = tiltTarget.getBoundingClientRect();
				cx = (e.clientX - r.left) / r.width - 0.5;
				cy = (e.clientY - r.top) / r.height - 0.5;
				if (!prefersReducedMotion && !tiltRaf) tiltRaf = requestAnimationFrame(tiltTick);
			};

			tiltTarget.addEventListener("pointermove", onTiltMove, { passive: true });
			tiltTarget.addEventListener(
				"pointerleave",
				() => {
					cx = 0;
					cy = 0;
					if (!prefersReducedMotion && !tiltRaf) tiltRaf = requestAnimationFrame(tiltTick);
				},
				{ passive: true }
			);
		}
	});
});
