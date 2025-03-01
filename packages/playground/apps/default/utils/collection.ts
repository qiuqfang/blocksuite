import { AffineSchemas } from '@blocksuite/blocks';
import { assertExists } from '@blocksuite/global/utils';
import {
  type BlobStorage,
  createIndexeddbStorage,
  DocCollection,
  type DocCollectionOptions,
  Generator,
  Job,
  Schema,
  type StoreOptions,
  Text,
} from '@blocksuite/store';
import { IndexedDBDocSource } from '@blocksuite/sync';

import { WebSocketAwarenessSource } from '../../_common/sync/websocket/awareness';
import { WebSocketDocSource } from '../../_common/sync/websocket/doc';

const BASE_WEBSOCKET_URL = new URL(import.meta.env.PLAYGROUND_WS);

export async function createDefaultDocCollection() {
  const blobStorages: ((id: string) => BlobStorage)[] = [
    createIndexeddbStorage,
  ];
  const idGenerator: Generator = Generator.NanoID;
  const schema = new Schema();
  schema.register(AffineSchemas);

  const params = new URLSearchParams(location.search);
  let docSources: StoreOptions['docSources'] = {
    main: new IndexedDBDocSource(),
  };
  let awarenessSources: StoreOptions['awarenessSources'];
  const room = params.get('room');
  if (room) {
    const ws = new WebSocket(new URL(`/room/${room}`, BASE_WEBSOCKET_URL));
    await new Promise(resolve => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', resolve);
    });
    docSources = {
      main: new IndexedDBDocSource(),
      shadow: [new WebSocketDocSource(ws)],
    };
    awarenessSources = [new WebSocketAwarenessSource(ws)];
  }

  const options: DocCollectionOptions = {
    id: 'quickEdgeless',
    schema,
    idGenerator,
    blobStorages,
    docSources,
    awarenessSources,
    defaultFlags: {
      enable_synced_doc_block: true,
      enable_bultin_ledits: true,
    },
  };
  const collection = new DocCollection(options);

  collection.start();

  // debug info
  window.collection = collection;
  window.blockSchemas = AffineSchemas;
  window.job = new Job({ collection });
  window.Y = DocCollection.Y;

  return collection;
}

export async function initDefaultDocCollection(collection: DocCollection) {
  const params = new URLSearchParams(location.search);

  await collection.waitForSynced();

  const shouldInit = collection.docs.size === 0 && !params.get('room');
  if (shouldInit) {
    const doc = collection.createDoc({ id: 'doc:home' });
    doc.load();
    const rootId = doc.addBlock('affine:page', {
      title: new Text(),
    });
    doc.addBlock('affine:surface', {}, rootId);
    doc.resetHistory();
  } else {
    // wait for data injected from provider
    const firstPageId =
      collection.docs.size > 0
        ? collection.docs.keys().next().value
        : await new Promise<string>(resolve =>
            collection.slots.docAdded.once(id => resolve(id))
          );
    const doc = collection.getDoc(firstPageId);
    assertExists(doc);
    doc.load();
    // wait for data injected from provider
    if (!doc.root) {
      await new Promise(resolve => doc.slots.rootAdded.once(resolve));
    }
    doc.resetHistory();
  }
}
