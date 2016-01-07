/**
 * Created by bcj on 2015/11/26.
 */

//test 1
/*
self.onmessage = function(event){
    var arr = event.data.array;
    var postMessage = self.webkitPostMessage || self.postMessage;
    try {
        postMessage({
            array : arr
        }, [arr.buffer]);
    } catch (e) {
        postMessage({});
    }
};*/

//test 2

self.onmessage = function(event){
    var res = event.data;
    var postMessage = self.webkitPostMessage || self.postMessage;
    var d;
    if(res.value === 123){
        d = 123123;
    }
    else{
        d = 321321;
    }
    var obj = {
        value : d
    };
    postMessage(obj);

};