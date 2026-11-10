import { useLayoutEffect, useRef, useState } from 'react';
import { Grip } from '../components/Row.tsx';
import { RowGroup } from '../components/RowGroup.tsx';
import { ddmm, listItems, sortedIdeas, type Idea } from '../domain/index.ts';
import { softDelete } from '../lib/actions.ts';
import { getNow, useNow } from '../lib/now.ts';
import { useGame } from '../store/game.ts';
import { toast, useUi, type ListSeg } from '../store/ui.ts';

const LISTS: [ListSeg, string][] = [
  ['todo', 'Task'],
  ['idea', 'Idee'],
  ['buy', 'Comprare'],
  ['hold', 'Sospeso'],
];

export function Lists() {
  const listSeg = useUi((s) => s.listSeg);
  return (
    <>
      <Segmented value={listSeg} />
      {listSeg === 'idea' ? <Ideas /> : <ItemList kind={listSeg} />}
    </>
  );
}

/* segmenti con l'indicatore che scorre */
function Segmented({ value }: { value: ListSeg }) {
  const seg = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const place = () => {
      const on = seg.current?.querySelector<HTMLButtonElement>('button.on');
      if (!on || !ind.current) return;
      ind.current.style.left = `${on.offsetLeft + 3}px`;
      ind.current.style.width = `${on.offsetWidth - 6}px`;
    };
    place();
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
    };
  }, [value]);

  return (
    <div className="seg" ref={seg} role="tablist">
      <span className="ind" ref={ind} />
      {LISTS.map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={value === v}
          className={value === v ? 'on' : ''}
          onClick={() => {
            useUi.getState().setListSeg(v);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ItemList({ kind }: { kind: Exclude<ListSeg, 'idea'> }) {
  const now = useNow();
  const items = useGame((s) => s.items);
  const list = listItems(items, kind, now.day);
  return (
    <div className="sec view" key={kind}>
      {list.length ? (
        <RowGroup items={list} k="l" now={now} commitBtn={kind !== 'hold'} />
      ) : (
        <div className="empty">
          {kind === 'hold'
            ? 'Niente in sospeso. Ci finisce quello che non dipende da te o che hai parcheggiato: non toglie XP.'
            : 'Lista vuota.'}
        </div>
      )}
    </div>
  );
}

function Ideas() {
  const ideas = sortedIdeas(useGame((s) => s.ideas));
  const [text, setText] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);

  const add = () => {
    if (!useGame.getState().addIdea(text, getNow())) {
      input.current?.focus();
      return;
    }
    setText('');
  };
  const ids = ideas.map((d) => d.id);
  const onReorder = (from: number, to: number) => {
    useGame.getState().reorder(ids, from, to, true);
  };

  return (
    <div className="view">
      <div className="idea-in">
        <textarea
          ref={input}
          rows={2}
          value={text}
          placeholder="Butta giù un'idea…"
          aria-label="Nuova idea"
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn" aria-label="Aggiungi idea" onClick={add}>
          +
        </button>
      </div>
      <div className="sec">
        {ideas.length ? (
          <div>
            {ideas.map((d) => (
              <IdeaCard key={d.id} idea={d} onReorder={onReorder} />
            ))}
          </div>
        ) : (
          <div className="empty">Nessuna idea.</div>
        )}
      </div>
    </div>
  );
}

function IdeaCard({
  idea,
  onReorder,
}: {
  idea: Idea;
  onReorder: (from: number, to: number) => void;
}) {
  return (
    <div className="idea" data-id={idea.id} data-k="i">
      <p
        role="button"
        tabIndex={0}
        onClick={() => {
          useUi.getState().openSheet({ type: 'editIdea', id: idea.id });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') useUi.getState().openSheet({ type: 'editIdea', id: idea.id });
        }}
      >
        {idea.text}
      </p>
      <div className="idea-f">
        <span>{ddmm(idea.createdOn)}</span>
        <div>
          <button
            type="button"
            className="mini"
            onClick={() => {
              useGame.getState().ideaToTask(idea.id, getNow());
              toast('Spostata in Task');
            }}
          >
            → TASK
          </button>
          <button
            type="button"
            className="mini"
            aria-label="Elimina idea"
            onClick={() => {
              softDelete(idea.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>
      <Grip onReorder={onReorder} />
    </div>
  );
}
