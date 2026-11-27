// Legacy dependencies pulled in by react-dragula (dragula -> crossvent ->
// custom-event) reference Node's `global`, which browsers do not define.
// Aliasing it to `globalThis` before those modules evaluate keeps them working
// in the browser (CRA's old webpack build used to provide this shim for us).
globalThis.global ??= globalThis;
