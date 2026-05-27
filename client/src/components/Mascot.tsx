import mascotBlue from "@/assets/mascot_blue.png";

/**
 * Study Stacks mascot. Decorative — rendered with empty alt + aria-hidden
 * alongside descriptive text.
 */
export const Mascot = () => (
  <img
    src={mascotBlue}
    width={80}
    alt=""
    aria-hidden="true"
    draggable={false}
    style={{ objectFit: "contain", display: "block" }}
  />
);

export default Mascot;
