(() => {
  'use strict';
  let connection;
  function database(){
    if(!connection)connection=new Promise((resolve,reject)=>{
      const request=indexedDB.open('text-print-order-files',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('files');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
    }).catch(error=>{connection=null;throw error;});
    return connection;
  }
  async function operation(mode,key,value){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('files',mode==='get'?'readonly':'readwrite');
      const store=transaction.objectStore('files');
      const request=mode==='put'?store.put(value,key):mode==='delete'?store.delete(key):store.get(key);
      transaction.oncomplete=()=>resolve(request.result);
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error('Не удалось сохранить макет'));
    });
  }
  window.TEXT_FILES={
    validate(file){
      if(!file)return 'Выберите файл.';
      if(file.size>100*1024*1024)return 'Файл больше 100 МБ. Укажите ссылку на него в комментарии.';
      if(!/\.(pdf|jpe?g|png|tiff?|svg|ai|eps|cdr|psd|zip)$/i.test(file.name))return 'Выберите PDF, изображение, исходник макета или ZIP-архив.';
      return '';
    },
    save:(key,file)=>operation('put',key,file),
    get:key=>operation('get',key),
    remove:key=>operation('delete',key),
    async download(key,name){
      const file=await operation('get',key);
      if(!file)throw new Error('Макет не найден в этом браузере. Прикрепите его ещё раз.');
      const url=URL.createObjectURL(file),link=document.createElement('a');
      link.href=url;link.download=name||file.name||'Макет';document.body.append(link);link.click();link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  };
})();
