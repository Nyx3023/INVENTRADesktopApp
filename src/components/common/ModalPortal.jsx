import { createPortal } from 'react-dom';

/**
 * ModalPortal - renders children directly into document.body,
 * escaping any CSS stacking context (backdrop-blur, transform, etc.)
 * that would trap `position: fixed` elements inside the layout.
 */
const ModalPortal = ({ children }) => {
  return createPortal(children, document.body);
};

export default ModalPortal;
