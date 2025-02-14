/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import test from 'ava';
import Worker from 'web-worker';

function createModuleWorker(url) {
	const worker = new Worker(url, { type: 'module' });
	worker.events = [];
	worker.addEventListener('message', e => {
		worker.events.push(e);
	});
	return worker;
}

function createWorker(url) {
	const worker = new Worker(url);
	worker.events = [];
	worker.addEventListener('message', e => {
		worker.events.push(e);
	});
	return worker;
}

function waitForMessageEvents(worker, target = 1) {
	let count = 0;
	return new Promise(r => worker.addEventListener('message', function onMessage() {
		count++;
		if (count >= target) {
			worker.removeEventListener('message', onMessage);
			r();
		}
	}));
}

async function testInstantiation(t, worker) {
	await waitForMessageEvents(worker);
	t.is(worker.events.length, 1, 'should have received a message event');
	t.is(worker.events[0].data, 42);
}

async function testPostMessage(t, worker) {
	// reset events list
	worker.events.length = 0;

	const msgEvents = waitForMessageEvents(worker, 2);
	const msg = { greeting: 'hello' };
	worker.postMessage(msg);
	const timestamp = Date.now();

	await msgEvents;

	t.is(worker.events.length, 2, 'should have received two message responses');
	
	const first = worker.events[0];
	t.is(first.data[0], 'received onmessage');
	t.assert(Math.abs(timestamp - first.data[1]) < 500);
	t.deepEqual(first.data[2], msg);
	t.not(first.data[2], msg);

	const second = worker.events[1];
	t.is(second.data[0], 'received message event');
	t.assert(Math.abs(timestamp - second.data[1]) < 500);
	t.deepEqual(second.data[2], msg);
	t.not(second.data[2], msg);
}

test('es module with relative path', async t => {
	const worker = createModuleWorker('./test/fixtures/worker.mjs');

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('es module with file protocol path', async t => {
	const worker = createModuleWorker(new URL('./fixtures/worker.mjs', import.meta.url));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('es module with data protocol path', async t => {
	const code = `import '${new URL('./fixtures/worker.mjs', import.meta.url)}';`;
	const worker = createModuleWorker('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('commonjs with relative path', async t => {
	const worker = createWorker('./test/fixtures/worker.cjs');

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('commonjs module with file protocol path', async t => {
	const worker = createWorker(new URL('./fixtures/worker.cjs', import.meta.url));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('commonjs module with data protocol path', async t => {
	const { fileURLToPath } = await import('url');
	const workerFileUrl = new URL('./fixtures/worker.cjs', import.meta.url).toString();
	const workerFilePath = fileURLToPath(workerFileUrl).replace(/\\/g, '/');

	const code = `require('${workerFilePath}');`;
	const worker = createWorker('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('no module with relative path', async t => {
	const worker = createWorker('./test/fixtures/worker.js');

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('no module with file protocol path', async t => {
	const worker = createWorker(new URL('./fixtures/worker.js', import.meta.url));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('no module with data protocol path', async t => {
	const code = `postMessage(42);

	self.onmessage = e => {
		postMessage(['received onmessage', e.timeStamp, e.data]);
	};
	
	addEventListener('message', e => {
		postMessage(['received message event', e.timeStamp, e.data]);
	});`;
	const worker = createModuleWorker('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('es module web worker in a web worker', async t => {
	const worker = createModuleWorker(new URL('./fixtures/worker-making-worker.mjs', import.meta.url));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test('commonjs web worker in a web worker', async t => {
	const worker = createWorker(new URL('./fixtures/worker-making-worker.cjs', import.meta.url));

	await testInstantiation(t, worker);
	await testPostMessage(t, worker);

	worker.terminate();
});

test.serial('close', async t => {
	const worker = new Worker('./test/fixtures/close.mjs', { type: 'module' });
	// Not emitted in the browser, just for testing
	const closed = await new Promise((resolve, reject) => {
		worker.addEventListener('close', () => resolve(true));
		setTimeout(reject, 500);
	});
	t.is(closed, true, 'should have closed itself');
});
