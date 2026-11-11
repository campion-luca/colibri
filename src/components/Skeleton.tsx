/** Skeleton minimale con la forma delle righe, solo al primo caricamento. */
export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div aria-busy="true" aria-label="Caricamento">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="row skel">
          <span className="skel-box" />
          <span className="skel-lines">
            <i />
            <i />
          </span>
        </div>
      ))}
    </div>
  );
}
