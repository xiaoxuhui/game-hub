    function restoreLatest() {
      try {
        const text=localStorage.getItem(AUTO);
        if(text===null)return false;
        const snapshot=decode(text);
        apply(snapshot);autosaveReady=true;storageStatus(true);return true;
      }catch(error){
        autosaveBlocked=true;
        feedback('最近现场无法读取，原始数据已保留，自动保存已暂停。请先导出备份：'+String(error?.message||error),true);
        storageStatus(false);return false;
      }
    }
