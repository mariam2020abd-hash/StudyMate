import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadCourses, saveCourses } from '../src/data/courseStorage.ts';

function store(value = null) {
  return { getItem: () => value, setItem: (_, next) => { value = next; } };
}

test('first visit and deleting the last course both restore an empty dashboard', () => {
  const storage = store();
  assert.deepEqual(loadCourses(storage), []);
  saveCourses(storage, []);
  assert.deepEqual(loadCourses(storage), []);
});

test('saved Arabic names, renamed chapters and review progress survive a new session', () => {
  const courses = [{ id: 7, name: 'قواعد البيانات', chapters: [{ title: 'العلاقات', done: true }] }];
  const storage = store();
  saveCourses(storage, courses);
  assert.deepEqual(loadCourses(storage), courses);
  courses[0].name = 'اسم مختلف';
  assert.equal(loadCourses(storage)[0].name, 'قواعد البيانات');
});

test('corrupted or incompatible data is rejected without overwriting the original', () => {
  for (const raw of ['broken json', '{}', '[null]', '[{"id":1,"name":"","chapters":[]}]', '[{"id":1,"name":"A","chapters":[{"title":"B","done":"false"}]}]', '[{"id":1,"name":"A","chapters":[]},{"id":1,"name":"B","chapters":[]}]']) {
    const storage = store(raw);
    assert.throws(() => loadCourses(storage));
    assert.equal(storage.getItem(), raw);
  }
});

test('blocked storage and quota errors propagate instead of reporting a successful save', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.throws(() => loadCourses(blocked), /blocked/);
  assert.throws(() => saveCourses(blocked, []), /quota/);
});
