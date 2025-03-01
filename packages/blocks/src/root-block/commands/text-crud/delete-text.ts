import type { Command, TextSelection } from '@blocksuite/block-std';
import { PathFinder } from '@blocksuite/block-std';
import { assertExists } from '@blocksuite/global/utils';
import type { EditorHost } from '@blocksuite/lit';
import type { Text } from '@blocksuite/store';

import { matchFlavours } from '../../../_common/utils/index.js';

export const deleteTextCommand: Command<
  'currentTextSelection',
  never,
  {
    textSelection?: TextSelection;
  }
> = (ctx, next) => {
  const textSelection = ctx.textSelection ?? ctx.currentTextSelection;
  assertExists(
    textSelection,
    '`textSelection` is required, you need to pass it in args or use `getTextSelection` command before adding this command to the pipeline.'
  );

  const host = ctx.std.host as EditorHost;
  assertExists(host.rangeManager);

  const range = host.rangeManager.textSelectionToRange(textSelection);
  if (!range) return;
  const selectedElements = host.rangeManager.getSelectedBlockElementsByRange(
    range,
    {
      mode: 'flat',
    }
  );

  const { from, to } = textSelection;

  const fromElement = selectedElements.find(el =>
    PathFinder.equals(from.path, el.path)
  );
  assertExists(fromElement);

  let fromText: Text | undefined;
  if (matchFlavours(fromElement.model, ['affine:page'])) {
    fromText = fromElement.model.title;
  } else {
    fromText = fromElement.model.text;
  }
  assertExists(fromText);
  if (!to) {
    fromText.delete(from.index, from.length);
    ctx.std.selection.setGroup('note', [
      ctx.std.selection.create('text', {
        from: {
          path: from.path,
          index: from.index,
          length: 0,
        },
        to: null,
      }),
    ]);
    return next();
  }

  const toElement = selectedElements.find(el =>
    PathFinder.equals(to.path, el.path)
  );
  assertExists(toElement);

  const toText = toElement.model.text;
  assertExists(toText);

  fromText.delete(from.index, from.length);
  toText.delete(0, to.length);

  selectedElements
    .filter(
      el =>
        el.model.id !== fromElement.model.id &&
        el.model.id !== toElement.model.id
    )
    .forEach(el => {
      ctx.std.doc.deleteBlock(el.model);
    });

  ctx.std.selection.setGroup('note', [
    ctx.std.selection.create('text', {
      from: {
        path: to.path,
        index: to.index,
        length: 0,
      },
      to: null,
    }),
  ]);

  next();
};

declare global {
  namespace BlockSuite {
    interface Commands {
      deleteText: typeof deleteTextCommand;
    }
  }
}
