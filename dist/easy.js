import {catalog} from './content.js?v=20261014c';
export const easy=Object.fromEntries(catalog.lessons.map(l=>[l.id,l.easy]));
