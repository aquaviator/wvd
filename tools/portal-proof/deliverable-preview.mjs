// Reuses verified bytes from the pinned reader; never fetches a browser URL.
// PNG structure follows https://www.w3.org/TR/png-3/. Browser decoding remains
// required before enabling approval. This is not a general image decoder.
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
export function deliverablePreview(proof){
  const bytes=proof.bytes,mediaType=proof.manifest.mediaType;
  if(mediaType==='text/plain'){
    try{return {contentText:new TextDecoder('utf-8',{fatal:true}).decode(bytes)};}catch{throw Error('DELIVERABLE_CONTENT_CONFLICT');}
  }
  if(mediaType!=='image/png')throw Error('DELIVERABLE_UNAVAILABLE');
  const data=Buffer.from(bytes);
  if(data.length<57||data.length>512*1024||!data.subarray(0,8).equals(signature))throw Error('DELIVERABLE_CONTENT_CONFLICT');
  let offset=8,width,height,seenData=false,ended=false,chunks=0;
  while(offset<data.length){
    if(offset+12>data.length||++chunks>4096)throw Error('DELIVERABLE_CONTENT_CONFLICT');
    const length=data.readUInt32BE(offset),end=offset+12+length;
    if(end>data.length)throw Error('DELIVERABLE_CONTENT_CONFLICT');
    const type=data.toString('ascii',offset+4,offset+8);
    if(!/^[A-Za-z]{4}$/.test(type)||crc32(data.subarray(offset+4,end-4))!==data.readUInt32BE(end-4))throw Error('DELIVERABLE_CONTENT_CONFLICT');
    if(offset===8){
      if(type!=='IHDR'||length!==13)throw Error('DELIVERABLE_CONTENT_CONFLICT');
      width=data.readUInt32BE(offset+8);height=data.readUInt32BE(offset+12);
      if(!width||!height||width>2048||height>2048)throw Error('DELIVERABLE_CONTENT_CONFLICT');
    }else if(type==='IHDR'||['acTL','fcTL','fdAT'].includes(type))throw Error('DELIVERABLE_CONTENT_CONFLICT');
    if(type==='IDAT')seenData=true;
    if(type==='IEND'){if(length!==0||end!==data.length||!seenData)throw Error('DELIVERABLE_CONTENT_CONFLICT');ended=true;}
    offset=end;
  }
  if(!ended)throw Error('DELIVERABLE_CONTENT_CONFLICT');
  return {mediaType,contentBase64:data.toString('base64'),width,height};
}
