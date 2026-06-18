// ── Shared Framer Motion variant library ──────────────────────────────────────

/** Page-level fade + slight upward slide on route enter */
export const pageTransition = {
  initial:  { opacity: 0, y: 14 },
  animate:  { opacity: 1, y: 0,  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  exit:     { opacity: 0, y: -10, transition: { duration: 0.18, ease: 'easeIn' } },
};

/** Card / row entrance — use with staggerChildren on parent */
export const cardEntrance = {
  initial:  { opacity: 0, y: 16 },
  animate:  { opacity: 1, y: 0,  transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

/** Stagger container — wraps a list of card items */
export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};


/** Button / chip tap feedback */
export const buttonTap = {
  whileHover: { scale: 1.02, transition: { duration: 0.15 } },
  whileTap:   { scale: 0.96, transition: { duration: 0.1  } },
};

/** Input focus glow wrapper (apply to input container div) */
export const inputFocus = {
  initial:    {},
  whileFocus: { boxShadow: '0 0 0 2px var(--cyan)', transition: { duration: 0.15 } },
};

/** Login card — bounce up from below */
export const loginCardEntrance = {
  initial:  { opacity: 0, y: 40, scale: 0.97 },
  animate:  { opacity: 1, y: 0,  scale: 1,    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

/** Shake animation for form error feedback */
export const shakeError = {
  animate: {
    x: [0, -8, 8, -6, 6, -4, 4, 0],
    transition: { duration: 0.45, ease: 'easeOut' },
  },
};

/** Deep View Flyout slide-in from right */
export const flyoutSlide = {
  initial:  { x: '100%', opacity: 0 },
  animate:  { x: '0%',   opacity: 1, transition: { duration: 0.3,  ease: [0.22, 1, 0.36, 1] } },
  exit:     { x: '100%', opacity: 0, transition: { duration: 0.22, ease: 'easeIn' } },
};

/** Backdrop fade */
export const backdropFade = {
  initial:  { opacity: 0 },
  animate:  { opacity: 1, transition: { duration: 0.2 } },
  exit:     { opacity: 0, transition: { duration: 0.18 } },
};

/** Nav item hover underline slide */
export const navItemHover = {
  whileHover: { y: -1, transition: { duration: 0.15 } },
  whileTap:   { y:  0, scale: 0.97 },
};

/** Alert card entrance */
export const alertEntrance = {
  initial:  { opacity: 0, x: 20 },
  animate:  { opacity: 1, x: 0,  transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } },
  exit:     { opacity: 0, x: 20, height: 0, marginBottom: 0, transition: { duration: 0.2 } },
};

/** Stat chip pop */
export const statChipPop = {
  initial:  { opacity: 0, scale: 0.85 },
  animate:  { opacity: 1, scale: 1,    transition: { duration: 0.22, ease: 'backOut' } },
};
