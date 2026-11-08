# Crypt Pikeman — three-pose rehearsal

An isolated visual prototype, accessible at `?sprite-test=pikeman` on the published game. The main campaign continues using its original single sprites. This rehearsal creates only disposable in-memory runs and does not call save or achievement APIs. It uses the real combat engine and real spell effects, with 32 identical Crypt Pikemen, fixed statistics and fresh HP/MP between opponents.

## Final assets and framing

- Resting pose: `public/art/foe-2.webp` (original, unchanged).
- Attack contact: `public/art/foe-2-attack.webp`.
- Receiving a hit: `public/art/foe-2-hurt.webp`.

The two new poses were made with the built-in image generation tool, editing the original sprite. All three delivery frames share the same 305 × 358 canvas and transparency. Mechanical PNG-to-WebP conversion/downsampling matches the existing mobile sprite. A fixed-aspect render box keeps the same scale on all three frames. Small translations align the foot baseline: attack (+6,+8) and hit (−3,+3) in source-canvas pixels, scaled with the render box. No per-pose zoom is used. The first generated attack was rejected because its weapon was still raised; the selected revision places the axe head low at the end of a downward arc.

Attack is displayed for 240 ms and hit reaction for 190 ms. Closely timed strikes are queued in order, with a short bounded queue cleared between opponents. Options offer original-image comparison, pause, half speed, still-frame inspection and effect visibility. The rehearsal is deliberately not rolled out to ordinary campaign encounters before user review.

## Final prompt set

### Receiving a hit

Use case: precise-object-edit. Edit target: the attached existing Crypt Pikeman game sprite. Make exactly ONE alternate animation pose of THIS SAME skeletal halberdier, not a redesign. Preserve its skull and helmet shape, bone anatomy, battered dark iron shoulder armor, red-brown torn cape and cloth strips, greenish waist details, exact same halberd design, colors and dark painted manga/fantasy rendering. Preserve the portrait canvas aspect ratio, camera angle, full-body framing, size of the head, overall body scale and planted foot positions/baseline. Entire skeleton AND entire weapon visible inside the frame with small transparent margins. True transparent background, no scene, floor, shadow disc, text, borders, panels, motion trails, flashes or added effects. Match the original finish rather than sharpening or making new ornate details. The movement must be restrained enough to read as a short combat animation frame. Change only the pose. Pose: RECEIVING A HIT. His upper torso recoils slightly backward, one shoulder drawn back, skull tilted back and jaw slightly open. Hands and the SAME halberd are pulled a little closer to the body, cape follows the recoil. It must remain the same standing skeleton with the same planted feet and body scale, still holding the weapon securely. No blood, dismemberment, new damage, glow, impact marks or large bend.

### Attack revision (selected)

Use case: precise-object-edit. IMAGE 1 is the edit target: the existing attack-pose skeletal halberdier. IMAGE 2 is the original resting sprite, an identity and framing reference. Make ONE corrected ATTACK-CONTACT / FOLLOW-THROUGH sprite. The previous pose merely lowered the ready stance; it is not an unmistakable strike. Change the ARMS AND HALBERD so that he has COMPLETED a powerful downward diagonal chopping arc. The AXE HEAD MUST NOW BE LOW, below his waist, toward the viewer's LOWER LEFT near his left shin/knee, not raised near his head. The long shaft runs diagonally from upper right near the right shoulder to lower left, gripped by BOTH bony hands near his waist/chest. Show the same original axe head/spike design at the low end of this diagonal, its cutting edge following through downward. The butt of the shaft is upper right. Compact readable finishing swing, no motion trail. Preserve EXACTLY the SAME skull, helmet, iron armor, torn red-brown cape, bones and halberd materials/colors from the two references. Keep the same portrait canvas, body size, camera, leg proportions and planted foot locations/baseline as IMAGE 1; do not zoom, crop, grow, shrink, redesign or move the whole figure. A small torso twist into the strike is allowed, but legs must stay almost unchanged. Full skeleton and full weapon visible, transparent margins, true transparent background. No ground, background, shadows behind the cutout, blood, glow, swoosh, text, frames or extra objects. Same restrained painted dark manga/fantasy game-sprite finish.

