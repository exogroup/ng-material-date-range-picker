/**
 * Options for scrolling an element into view
 */
export interface ScrollIntoViewOptions {
  /** Scroll behavior: 'smooth' for animated scroll, 'auto' for instant */
  behavior?: 'smooth' | 'auto';
  /** Alignment of the element: 'center', 'start', 'end', or 'nearest' */
  block?: 'center' | 'start' | 'end' | 'nearest';
  /** Optional callback to execute after scroll completes */
  onScrollComplete?: () => void;
}

/**
 * Check if an element is fully visible within a scrollable container
 *
 * @param container - The scrollable container element
 * @param element - The element to check
 * @returns true if the element is fully visible in the horizontal axis, false otherwise
 */
export function isElementInView(container: HTMLElement, element: HTMLElement): boolean {
  if (!container || !element) {
    return false;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Check if element is within the horizontal visible area of the container
  return elementRect.left >= containerRect.left && elementRect.right <= containerRect.right;
}

/**
 * Check if an element is partially visible within a scrollable container
 *
 * @param container - The scrollable container element
 * @param element - The element to check
 * @returns true if any part of the element is visible in the horizontal axis, false otherwise
 */
export function isElementPartiallyInView(container: HTMLElement, element: HTMLElement): boolean {
  if (!container || !element) {
    return false;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Check if any part of element is within the horizontal visible area
  return elementRect.right > containerRect.left && elementRect.left < containerRect.right;
}

/**
 * Scroll an element into view within a scrollable container if it's not currently visible
 *
 * @param container - The scrollable container element
 * @param element - The element to scroll into view
 * @param options - Optional scroll configuration
 */
export function scrollElementIntoView(
  container: HTMLElement,
  element: HTMLElement,
  options: ScrollIntoViewOptions = {}
): void {
  if (!container || !element) {
    return;
  }

  // Check if element is already in view
  if (isElementInView(container, element)) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Calculate the position to scroll to
  let scrollLeft = container.scrollLeft;
  const elementRelativeLeft = elementRect.left - containerRect.left + container.scrollLeft;

  const block = options.block || 'nearest';

  switch (block) {
    case 'start':
      scrollLeft = elementRelativeLeft;
      break;
    case 'end':
      scrollLeft = elementRelativeLeft - container.clientWidth + element.offsetWidth;
      break;
    case 'center':
      scrollLeft = elementRelativeLeft - (container.clientWidth / 2) + (element.offsetWidth / 2);
      break;
    case 'nearest':
    default:
      // If element is to the left of visible area, align to start
      if (elementRect.left < containerRect.left) {
        scrollLeft = elementRelativeLeft;
      }
      // If element is to the right of visible area, align to end
      else if (elementRect.right > containerRect.right) {
        scrollLeft = elementRelativeLeft - container.clientWidth + element.offsetWidth;
      }
      break;
  }

  // Perform the scroll
  container.scrollTo({
    left: scrollLeft,
    behavior: options.behavior || 'smooth'
  });

  // Execute callback after scroll completes
  if (options.onScrollComplete) {
    setTimeout(() => {
      options.onScrollComplete!();
    }, options.behavior === 'smooth' ? 300 : 0);
  }
}
