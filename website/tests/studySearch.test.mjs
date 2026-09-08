import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchChapters, searchCourses } from '../src/utils/studySearch.ts';

const chapters = [{ title: 'مُقدِّمة', done: true }, { title: 'Arrays', done: false }, { title: 'إدارة البيانات', done: false }];
const courses = [{ id: 1, name: 'أساسيات البرمجة', chapters }, { id: 2, name: 'رياضيات', chapters: [] }];

test('search handles Arabic diacritics, alef variants, English case and whitespace', () => {
  assert.equal(searchCourses(courses, ' اساسيات ').length, 1);
  assert.equal(searchCourses(courses, 'مقدمة').length, 1);
  assert.equal(searchCourses(courses, 'ARRAYS').length, 1);
  assert.equal(searchCourses(courses, 'غير موجود').length, 0);
  assert.equal(searchCourses(courses, ' ').length, 2);
});

test('filtered chapter actions retain the original position, including duplicate titles', () => {
  const entries = [...chapters, { title: 'Arrays', done: true }];
  assert.deepEqual(searchChapters(entries, 'arrays', 'pending').map(item => item.index), [1]);
  assert.deepEqual(searchChapters(entries, 'arrays', 'done').map(item => item.index), [3]);
  assert.deepEqual(searchChapters(entries, '', 'all').map(item => item.index), [0, 1, 2, 3]);
  assert.equal(searchChapters(entries, 'ادارة', 'done').length, 0);
  assert.equal(entries.length, 4);
});
