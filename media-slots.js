const fighterNames={safari:'Asli Tiger',spin:'Jon the Don',blast:'Tiger Khauf',slap:'Baburao',burst:'Bawa',spit:'Vimal Man'};
const voices={safari:'special-voice.mp3',spin:'jon-special.mp3',blast:'tiger-special.mp3',slap:'babu-special.mp3',burst:'bawa-special.mp3',spit:'vimal-special.mp3'};
const portraits={safari:'asli',spin:'jon',blast:'tiger',slap:'baburao',burst:'bawa',spit:'vimal'};
export const MEDIA_SLOTS={};
for(const [kind,name] of Object.entries(fighterNames)){
 MEDIA_SLOTS['special-'+kind]={label:name+' — Special audio',type:'audio',path:'/assets/'+voices[kind]};
 MEDIA_SLOTS['entry-'+kind]={label:name+' — Entrance audio',type:'audio',path:'/assets/entry-'+kind+'.mp3'};
 MEDIA_SLOTS['portrait-'+kind]={label:name+' — Fighter portrait',type:'image',path:'/assets/ui/'+portraits[kind]+'-roster.png'};
}
for(const [key,label,path,type] of [
 ['battle','Fight background music','battle-music.mp3','audio'],['knockout','Round knockout sound','knockout.mp3','audio'],['finish','Match ending sound','samay-samapti.wav','audio'],
 ['wordmark','Game logo','ui/bollybrawl-wordmark.webp','image'],['loading','Loading screen artwork','ui/loading-ring.webp','image'],
 ['thoko','Thoko Machine portrait','ui/commentator-thoko.png','image'],['karan','Kala Khatha portrait','ui/commentator-karan.png','image'],
 ['filmcity','Film City arena card','ui/arena-filmcity.jpg','image'],['akhada','Akhada arena card','ui/arena-akhada.jpg','image'],['cinema','Cinema arena card','ui/arena-cinema.jpg','image'],
 ['packet','Vimal packet texture','vimal-packet.webp','image']
])MEDIA_SLOTS[key]={label,type,path:'/assets/'+path};
