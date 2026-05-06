/**
 * Sets a data attribute on the document's root element (html tag)
 * @param key The attribute key (will be prefixed with 'data-')
 * @param value The attribute value
 */
const setDataAttribute = (key: string, value: string): void => {
  try {
    // Sanitize the value to prevent XSS
    const sanitizedValue = value.replaceAll(/[^\w-]/g, '');
    document.documentElement.setAttribute(`data-${key}`, sanitizedValue);
  } catch (error) {
    console.error(`Error setting data attribute ${key}:`, error);
  }
};

export { setDataAttribute };
