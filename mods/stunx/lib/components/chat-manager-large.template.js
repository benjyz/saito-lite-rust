const ChatManagerLargeTemplate = (call_type) => {
  return `
    <div class="stunx-chatbox" id="stunx-chatbox">
      <main>
        <section class="large-wrapper">
      
        </section>

        <section class="footer">
        <div class="control-panel">
        <div class="timer">
            <p class="counter"> 00.00 </p>
            <div class="users-on-call">
                <div class="image-list">
                    
                </div>
                <p > <span class="users-on-call-count">1</span> on call </p>
            </div>
        </div>  
        <div class="control-list">
           <span>
            <i class=" audio_control fa fa-microphone" > </i>
            </span>
            <span  style=" background-color: ${call_type === "audio" ?  "grey" : "white"}">
            <i  style=" cursor :${call_type === "audio" ? "none" : "pointer" }; color:${call_type === "audio" ? "black" : "green" }  " class=" video_control  fas fa-video"> </i>
            </span>
            <span>
            <i class="disconnect_btn  fas fa-phone"> </i>
            </span>
        </div>
    </div>
        </section>
      </main>


    </div>`
}

module.exports = ChatManagerLargeTemplate;

{/* <div class="box">
<button class="b-btngrid">2h5dt6dd678s..</button>
</div>
<div class="box">
<button class="b-btngrid">2h5dt6dd678s..</button>
</div> */}

// <i class="audio_control fa fa-microphone-slash" aria-hidden="true"></i>


      // <video id="localStream" muted="true"  class="box" style="display: block" autoplay>
      //       <button class="b-btngrid">2h5dt6dd678s..</button>
      //     </video>
      //     <video id="remoteStream1"   autoplay class="box">
      //       <button class="b-btngrid">2h5dt6dd678s..</button>
      //     </video>
      //     <video id="remoteStream2"   autoplay class="box">
      //       <button class="b-btngrid">2h5dt6dd678s..</button>
      //     </video>
      //     <video id="remoteStream3"    autoplay class="box">
      //       <button class="b-btngrid">2h5dt6dd678s..</button>
      //     </video>
      //     <video id="remoteStream4" style="display: none"   autoplay class="box">
      //       <button class="b-btngrid">2h5dt6dd678s..</button>
      //     </video>