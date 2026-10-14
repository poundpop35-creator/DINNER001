import {lessons} from './lessons.js?v=20261014h';
export const easy=Object.fromEntries(lessons.map(l=>[l.id,l.easy]));
