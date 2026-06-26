/**
 * Documentation for accessibility best practices
 */

/**
 * Accessibility Checklist for BauPro
 * 
 * ## Keyboard Navigation
 * - All interactive elements must be reachable via Tab/Shift+Tab
 * - Links, buttons, and form fields must have :focus-visible styles
 * - Use role="button" for divs/spans that act as buttons
 * - Skip links should appear on focus to allow jumping to main content
 * 
 * ## ARIA Labels
 * - Every form input must have a <label> or aria-label
 * - Buttons must have text or aria-label describing their action
 * - Navigation landmarks should use <nav>, <main>, <aside>
 * - Use aria-live="polite" for dynamic content updates
 * - Use aria-current="page" for current page in navigation
 * 
 * ## Color & Contrast
 * - Minimum 4.5:1 contrast ratio for normal text
 * - Minimum 3:1 contrast ratio for large text (18pt+)
 * - Don't use color alone to convey information
 * - Use patterns or text labels in addition to colors
 * 
 * ## Images & Icons
 * - All icons must have aria-hidden="true" if decorative
 * - All images must have alt text
 * - Lucide icons with role="img" must have aria-label
 * 
 * ## Forms
 * - Group related fields with <fieldset> and <legend>
 * - Use aria-describedby for error messages
 * - Use aria-invalid="true" for invalid fields
 * - Provide clear, persistent error messages
 * 
 * ## Mobile
 * - Touch targets should be at least 44x44 pixels
 * - Avoid hover-only interactions
 * - Support both portrait and landscape
 * - Zoom should work up to 200%
 */

export const A11Y_CHECKLIST = [
  'Keyboard navigation fully supported',
  'All buttons and links have proper labels',
  'Color contrast meets WCAG AA standards',
  'Form inputs have associated labels',
  'Error messages are clear and persistent',
  'Focus indicators are visible',
  'Touch targets are at least 44x44px',
  'Images have alt text',
  'Page structure uses proper semantic HTML',
  'Dynamic content updates announced to screen readers'
];
