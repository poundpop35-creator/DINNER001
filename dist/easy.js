import {catalog} from './content.js?v=20261014b';
export const easy=Object.fromEntries(catalog.lessons.map(l=>[l.id,l.easy]));
