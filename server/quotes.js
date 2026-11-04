import { quotes } from './quote-library.js';
import { quoteSettings } from '../public/quotes-settings.js';

export function quoteForDay(date,slot) {
  const day=Math.floor(Date.parse(`${date}T00:00:00Z`)/86400000);
  return quotes[((day*3+slot)%quotes.length+quotes.length)%quotes.length];
}

export function dueQuotes(device,now) {
  const preferences=quoteSettings(device.quotes);
  if(!preferences.enabled)return [];
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:device.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const due=new Map();
  // A short catch-up window also covers late cron runs across midnight.
  for(let ago=4;ago>=0;ago--){
    const parts=Object.fromEntries(formatter.formatToParts(new Date(now.getTime()-ago*60000)).map(p=>[p.type,p.value]));
    const date=`${parts.year}-${parts.month}-${parts.day}`,time=`${parts.hour}:${parts.minute}`;
    preferences.times.forEach((scheduled,slot)=>{
      if(scheduled!==time)return;
      const quote=quoteForDay(date,slot),event=`quote:${date}:${slot}`;
      due.set(event,{title:'Quotes',body:quote.author?`${quote.text} — ${quote.author}`:quote.text,tag:`quote-${slot}`,event,url:'/#quotes'});
    });
  }
  return [...due.values()];
}
