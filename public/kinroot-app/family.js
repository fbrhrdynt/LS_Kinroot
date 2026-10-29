import {VERSION} from './domain.js';
export function emptyFamily(){return {schemaVersion:3,appVersion:VERSION,familyName:'Keluarga saya',persons:[],partnerships:[],parentChild:[],activity:[],updatedAt:new Date().toISOString()};}
export function personSubtitle(p){return ({male:'Laki-laki',female:'Perempuan',unknown:'Anggota keluarga'})[p.gender]||'Anggota keluarga';}
export function stepOriginNote(data,p){const parents=data.parentChild.filter(r=>r.childId===p.id&&r.type==='biological'&&r.status==='confirmed').map(r=>data.persons.find(parent=>parent.id===r.parentId)?.name).filter(Boolean);return parents.length?`Anak dari hubungan sebelumnya (biologis dari ${parents.join(', ')})`:'Hubungan tiri · orang tua biologis belum dicatat';}
