Dice texture assets folder.

Current implementation uses runtime CanvasTexture generation in `Dice3D.vue` to guarantee:
- Correct face mapping order (`+X:3, -X:4, +Y:1, -Y:6, +Z:5, -Z:2`)
- No file-loading delay during realtime rounds
- Consistent orientation across desktop and mobile

If you want static texture files, place them in this folder and map them in `Dice3D.vue`.
