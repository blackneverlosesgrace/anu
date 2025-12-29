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
	const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

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

	prefixRootRelativeLinks();

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

	// Scroll progress + scroll-speed blur
	let targetProgress = 0;
	let smoothProgress = 0;
	let lastScrollY = window.scrollY;
	let targetBlurPx = 0;
	let smoothBlurPx = 0;
	let targetHeroY = 0;
	let smoothHeroY = 0;
	let targetHeroSkew = -5;
	let smoothHeroSkew = -5;

	const parallaxItems = Array.from(document.querySelectorAll("[data-parallax]"));
	let parallaxRaf = 0;
	const updateParallax = () => {
		parallaxRaf = 0;
		for (const el of parallaxItems) {
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
		if (prefersReducedMotion) return;
		if (parallaxRaf) return;
		parallaxRaf = requestAnimationFrame(updateParallax);
	};

	const onScroll = () => {
		const doc = document.documentElement;
		const max = Math.max(1, doc.scrollHeight - window.innerHeight);
		targetProgress = window.scrollY / max;

		const dy = Math.abs(window.scrollY - lastScrollY);
		lastScrollY = window.scrollY;
		targetBlurPx = Math.min(10, dy / 18);

		// Hero wordmark: restrained but very alive
		const heroDrift = clamp(window.scrollY / window.innerHeight, 0, 1.4);
		targetHeroY = heroDrift * 22;
		targetHeroSkew = clamp(-6 + heroDrift * 6, -6, 1);
		requestParallax();
	};
	window.addEventListener("scroll", onScroll, { passive: true });
	window.addEventListener("resize", requestParallax, { passive: true });
	onScroll();

	if (!prefersReducedMotion) {
		let scrollRaf = 0;
		const scrollTick = () => {
			scrollRaf = 0;
			smoothProgress += (targetProgress - smoothProgress) * 0.08;
			smoothBlurPx += (targetBlurPx - smoothBlurPx) * 0.12;
			smoothHeroY += (targetHeroY - smoothHeroY) * 0.10;
			smoothHeroSkew += (targetHeroSkew - smoothHeroSkew) * 0.10;
			root.style.setProperty("--scroll", String(smoothProgress));
			root.style.setProperty("--scrollBlur", `${smoothBlurPx.toFixed(2)}px`);
			root.style.setProperty("--heroWordmarkY", `${smoothHeroY.toFixed(2)}px`);
			root.style.setProperty("--heroWordmarkSkew", `${smoothHeroSkew.toFixed(2)}deg`);

			const stillAnimating =
				Math.abs(targetProgress - smoothProgress) > 0.0006 ||
				Math.abs(targetBlurPx - smoothBlurPx) > 0.02 ||
				Math.abs(targetHeroY - smoothHeroY) > 0.02 ||
				Math.abs(targetHeroSkew - smoothHeroSkew) > 0.02;
			if (stillAnimating) {
				scrollRaf = requestAnimationFrame(scrollTick);
			}
		};
		const requestScrollTick = () => {
			if (scrollRaf) return;
			scrollRaf = requestAnimationFrame(scrollTick);
		};
		window.addEventListener("scroll", requestScrollTick, { passive: true });
		requestScrollTick();
	} else {
		root.style.setProperty("--scroll", String(targetProgress));
		root.style.setProperty("--scrollBlur", "0px");
		root.style.setProperty("--heroWordmarkY", `${targetHeroY.toFixed(2)}px`);
		root.style.setProperty("--heroWordmarkSkew", `${targetHeroSkew.toFixed(2)}deg`);
	}

	// Hover/pointer effects (defer to idle to reduce initial load work)
	onIdle(() => {
		// Card hotspot gradient follows cursor
		const cards = Array.from(document.querySelectorAll(".card"));
		cards.forEach((card) => {
			card.addEventListener(
				"pointermove",
				(e) => {
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
