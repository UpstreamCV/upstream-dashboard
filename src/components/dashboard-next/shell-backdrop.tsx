// Five heavily blurred creek-color orbs that slowly drift over the solid
// creek-mid shell: 2 deep clustered bottom-left, 1 mid top-left, 2 moss
// clustered top-right (positions/animation in theme.css). Pure CSS, so this
// stays a Server Component. Fixed layer; shell content sits above at z-10.
export function ShellBackdrop() {
  return (
    <div className="dn-backdrop" aria-hidden>
      <span className="dn-orb dn-orb-1" />
      <span className="dn-orb dn-orb-2" />
      <span className="dn-orb dn-orb-3" />
      <span className="dn-orb dn-orb-4" />
      <span className="dn-orb dn-orb-5" />
    </div>
  );
}
