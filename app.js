'use strict';
// Public UI only. Never store secret role stories, unrevealed card bodies or GM answers here.
const people=['ロラン','ディアナ','キエル','ハリー','コレン','グエン'];
const roles=document.getElementById('roles');
people.forEach((name,i)=>{const el=document.createElement('article');const num=document.createElement('span');num.textContent='CHARACTER '+String(i+1).padStart(2,'0');const heading=document.createElement('h3');heading.textContent=name;el.append(num,heading);roles.append(el)});
document.getElementById('join').addEventListener('click',()=>{document.getElementById('status').textContent='公開画面プレビューです。安全な同期と非公開カードはバックエンド設定後に利用できます。'});
