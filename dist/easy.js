import {lessons} from './lessons.js?v=20261014f';
export const easy=Object.fromEntries(lessons.map(l=>[l.id,l.easy]));
