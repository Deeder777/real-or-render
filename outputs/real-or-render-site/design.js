/* Presentation adapter only. The existing app owns the deck, answers, score and clock. */
(() => {
  const palette=['#FF8A5B','#FFD25A','#7AD3A8','#7FB2FF','#B79BFF','#FF9EC7','#4DD0E1','#FFB86B','#A6E06B'];
  const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const t=(key,values)=>window.ROR_I18N.t(key,values);
  function stickerize(element,color='yellow') {
    if(!element)return;
    const words=element.textContent.trim().split(/\s+/),last=words.pop();
    element.innerHTML=(words.length?escape(words.join(' '))+' ':'')+`<span class="sticker sticker--${color}">${escape(last||'')}</span>`;
  }
  function localize(){
    document.querySelectorAll('[data-redesign-i18n]').forEach(element=>{element.textContent=t(element.dataset.redesignI18n);});
    for(const [selector,key,color] of [['.play-settings>.section-label','modeHeading','mint'],['.quick-guide>.section-label','howHeading','lilac']]){
      const element=document.querySelector(selector);if(element){element.textContent=t(key);stickerize(element,color);}
    }
    document.querySelectorAll('[data-language]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.language===window.ROR_I18N.language)));
    document.querySelector('.language-pills')?.setAttribute('aria-label',t('languageLabel'));
    document.getElementById('inspect-photo')?.setAttribute('aria-label',t('inspect'));
    stickerize(document.getElementById('question'));
  }
  function card(item,answer,index){
    const hash=[...item.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
    const frame=document.getElementById('photo-frame'),game=document.querySelector('.game'),stamp=document.getElementById('answer-stamp');
    frame.style.setProperty('--exhibit-color',palette[hash%palette.length]);
    stamp.hidden=!answer;
    if(!answer){game.removeAttribute('data-answer-state');return;}
    game.setAttribute('data-answer-state',answer.correct?'correct':'wrong');
    stamp.dataset.truth=item.ai?'ai':'real';stamp.textContent=t(item.ai?'stampAI':'stampReal');
    const mood=answer.correct?'happy':'dizzy',reaction=document.getElementById('reveal-critter');
    reaction.dataset.mood=mood;reaction.className='reveal-critter '+mood;
    reaction.innerHTML=window.critterSVG(hash%60,{mood,body:'#FFF6E9'});
  }
  function timer(left,total){
    document.getElementById('timer-strip').style.setProperty('--time',`${Math.max(0,Math.min(1,left/total))*360}deg`);
    document.getElementById('timer-seconds').textContent=String(Math.ceil(left/1000));
  }
  function result(correct){
    const element=document.getElementById('result-critter'),mood=correct>=4?'happy':'dizzy';
    element.innerHTML=window.critterSVG(correct,{mood,body:'#FFF6E9'});element.dataset.mood=mood;
  }
  document.querySelectorAll('[data-critter]').forEach(element=>{element.innerHTML=window.critterSVG(Number(element.dataset.critter),{body:element.dataset.body});});
  document.querySelector('.ready-icon').innerHTML=window.critterSVG(2,{body:'#FFF6E9'});
  document.querySelectorAll('[data-language]').forEach(button=>button.addEventListener('click',()=>{
    const select=document.getElementById('language-select');select.value=button.dataset.language;select.dispatchEvent(new Event('change',{bubbles:true}));
  }));
  window.ROR_DESIGN={stickerize,localize,card,timer,result};
})();
