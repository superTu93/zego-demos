var zg,
  now = new Date().getTime(),
  _config = {
    "appid": 1234567,
    "deviceId": 'deviceid01',
    "deviceType": '',
    "anType": 0,   //Area Network Type. 0,外网接入；1,内网接入
    "idName": '' + new Date().getTime(),
    "nickName": 'u' + now,
    //"server": serverEnv.h5,
    "dispatchServer": 'https://test.zegonetwork.com:1143/dispatch/connection',
    "logLevel": 100,
    "logUrl": "",
    "remoteLogLevel": 0,
    "roomFlag": true,
    //"audienceCreateRoom": false,
    "testEnvironment": false
  },
  loginRoom = false,
  previewVideo,
  isLogin = false,
  isPreviewed = false,
  isPublish = false,
  $userList = [],
  userRole = 1, // 全局存一份角色
  streamId = _config.idName
let apiDomain = "https://test.zegonetwork.com:1143";
recordConfig = {
  remoteUserid: '',

}

function init () {
  previewVideo = $('#previewVideo')[0];

  zg = new ZegoClient();
  // debugger;
  var version = ZegoClient.getCurrentVersion();
  console.info(version);
  setConfig(zg);
  console.log("初始化sdk");
  const buffer = zg.audioMixing.ac.createBuffer(1, 1, zg.audioMixing.ac.sampleRate);
  console.log("创建buffer");
  const sample = zg.audioMixing.ac.createBufferSource();
  console.log("创建buffer源");
  sample.buffer = buffer;
  console.log("buffer赋值");
  sample.connect(zg.audioMixing.ac.destination);
  console.log("connect");
  sample.start();
  console.log("开始混音");
  console.log("config param:" + JSON.stringify(_config));

  zg.config(_config);

  zg.setTurnOverTcpOnly($('#turnOverTcpOnly').val() * 1 ? true : false);

  enumDevices();

  // 监听sdk回掉
  listen();
}

function openHall () {
  tokenUrl = "https://test.zegonetwork.com:1143/logintoken";

  $.ajax({
    type: 'POST',
    url: tokenUrl,
    data: JSON.stringify({
      "seq": 1,
      "timestamp": Math.ceil(new Date().getTime() / 1000),
      "app_id": _config.appid,
      "user_id": _config.idName,
      "user_name": _config.nickName,
      "queue_role": 10,
      "room_role": 0,
      "net_type": 2,
      "device_id": _config.deviceId
    }),
    success: res => {
      loginToken = res.login_token
      zg.login(loginToken, () => {
        alert('登录大厅成功')
      }, err => {
        alert('登录大厅失败 ' + err.code + err.msg)
      })
    },
    contentType: 'application/json',
    dataType: 'json'
  })
}


function enumDevices () {
  var audioInputList = [], videoInputList = [];
  zg.enumDevices(deviceInfo => {
    console.log('enumDevices' + JSON.stringify(deviceInfo));
    if (deviceInfo.microphones) {
      for (let i = 0; i < deviceInfo.microphones.length; i++) {

        if (!deviceInfo.microphones[i].label) {
          deviceInfo.microphones[i].label = 'microphone' + i;
        }
        audioInputList.push(' <option value="' + deviceInfo.microphones[i].deviceId + '">' + deviceInfo.microphones[i].label + '</option>');
        console.log("microphone: " + deviceInfo.microphones[i].label);
      }
      audioInputList.push('<option value="0">禁用</option>');
    }

    if (deviceInfo.cameras) {
      for (let i = 0; i < deviceInfo.cameras.length; i++) {
        if (!deviceInfo.cameras[i].label) {
          deviceInfo.cameras[i].label = 'camera' + i;
        }
        videoInputList.push('<option value="' + deviceInfo.cameras[i].deviceId + '">' + deviceInfo.cameras[i].label + '</option>');
        console.log("camera: " + deviceInfo.cameras[i].label);
      }
      videoInputList.push('<option value="0">禁用</option>');
    }

    $('#audioList').html(audioInputList.join(''));
    $('#videoList').html(videoInputList.join(''));
  }, function (error) {
    console.error("enum device error: " + error);
  });
}

function getPreviewConfig () {
  return {
    "audio": $('#audioList').val() === '0' ? false : true,
    "audioInput": null,
    "video": $('#videoList').val() === '0' ? false : true,
    "videoInput": $('#videoList').val() ? $('#videoList').val() : null,
    "videoQuality": $('#videoQuality').val() ? $('#videoQuality').val() * 1 : 2,
    "horizontal": true,
    "externalCapture": false,
    "externalMediaStream": null,
    "width": $('#width').val() * 1,
    "height": $('#height').val() * 1,
    "frameRate": $('#frameRate').val() * 1,
    "bitRate": $('#videoBitRateInput').val() * 1,
    audioBitRate: $('#audioBitRateInput').val() * 1,
//    noiseSuppression: true,
    noiseSuppression: $('#noiseSuppression').val() === '1',
    autoGainControl: $('#autoGainControl').val() === '1',
    echoCancellation: $('#echoCancellation').val() === '1'
//    autoGainControl: true,
//    echoCancellation: true
  }
}

//推流
function publish () {
  var videoCodeType = $('#videoCodeType').val();
  zg.startPublishingStream(streamId, previewVideo, null, {videoDecodeType: videoCodeType ? videoCodeType : 'H264'});
}


function play (streamList) {
  if (!streamList.length) return
  let {stream_id, extra_info} = streamList[0];
  let videoCodeType = extra_info ? JSON.parse(extra_info).videoCodeType : 'H264';
  const remoteVideo = getRemoteVideo()
  zg.startPlayingStream(stream_id, remoteVideo, '', {
    videoDecodeType: videoCodeType
  });
  remoteVideo.muted = false;
}

function clearPlay () {
  const remoteVideoContainer = document.getElementById('remoteVideoContainer')
  let remoteVideo = document.getElementById('remoteVideo')
  remoteVideo && remoteVideoContainer.removeChild(remoteVideo)
}


function listen () {
  var _config = {

    onPlayStateUpdate: function (type, streamid, error) {
      if (type == 0) {
        console.info('play  success');
      } else if (type == 2) {
        console.info('play retry');
      } else {

        console.error("play error " + error.msg);

        var _msg = error.msg;
        if (error.msg.indexOf('server session closed, reason: ') > -1) {
          var code = error.msg.replace('server session closed, reason: ', '');
          if (code == 21) {
            _msg = '音频编解码不支持(opus)';
          } else if (code == 22) {
            _msg = '视频编解码不支持(H264)'
          } else if (code == 20) {
            _msg = 'sdp 解释错误';
          }
        }
        alert('拉流失败,reason = ' + _msg);
      }

    },

    onPublishStateUpdate: function (type, streamid, error) {
      if (type == 0) {
        console.info(' publish  success');
        isPublish = true
      } else if (type == 2) {
        console.info(' publish  retry');
      } else {
        console.error('publish error ' + error.msg);
        isPublish = false
        var _msg = error.msg;
        if (error.msg.indexOf('server session closed, reason: ') > -1) {
          var code = error.msg.replace('server session closed, reason: ', '');
          if (code == 21) {
            _msg = '音频编解码不支持(opus)';
          } else if (code == 22) {
            _msg = '视频编解码不支持(H264)'
          } else if (code == 20) {
            _msg = 'sdp 解释错误';
          }
        }
        alert('推流失败,reason = ' + _msg);

      }

    },

    onPublishQualityUpdate: function (streamid, quality) {
      console.info("#" + streamid + "#" + "publish " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
    },

    onPlayQualityUpdate: function (streamid, quality) {
      console.info("#" + streamid + "#" + "play " + " audio: " + quality.audioBitrate + " video: " + quality.videoBitrate + " fps: " + quality.videoFPS);
    },

    onDisconnect: function (error) {
      console.error("onDisconnect " + JSON.stringify(error));
      alert('网络连接已断开' + JSON.stringify(error));
      leaveRoom();
    },

    onKickOut: function (error) {
      console.error("onKickOut " + JSON.stringify(error));
      if (error.code == 'VideoTalkOut') {
        isPreviewed && zg.stopPreview(previewVideo);
        isPublish && zg.stopPublishingStream(streamId)
        isPreviewed = false
        isPublish = false
        clearPlay()
      }
    },

    onTempBroken: function () {
      console.warn('temp broken ,start reconnect')
    },

    onReconnect: function () {
      alert('重连成功')
    },

    onStreamUpdated: function (type, streamList) {
      if (type === 0) {
        let {stream_id, extra_info} = streamList[0];
        let videoCodeType = extra_info ? JSON.parse(extra_info).videoCodeType : 'H264';
        const remoteVideo = getRemoteVideo()
        zg.startPlayingStream(stream_id, remoteVideo, '', {
          videoDecodeType: videoCodeType
        });
        remoteVideo.muted = false;
      } else {
      }

    },

    onStreamExtraInfoUpdated: function (streamList) {
      console.log('onStreamExtraInfoUpdated');
      console.log(streamList);
    },

    onVideoSizeChanged: function (streamid, videoWidth, videoHeight) {
      console.info("#" + streamid + "#" + "play " + " : " + videoWidth + "x" + videoHeight);
    },
    onUserStateUpdate: function (roomId, userList) {
      console.log('onUserStateUpdate', roomId, userList);
      userList.forEach(function (item) {
        if (item.action === 0) {
          $userList.push(item);
        } else if (item.action === 1) {
          $userList.forEach(function (item2, index) {
            if (item.idName === item2.idName) {
              $userList.splice(index, 1)
            }
          })
        }


      })
      $('#memberList').html('');
      $userList.forEach(function (item) {
        item.idName !== window._config.idName && $('#memberList').append('<option value="' + item.idName + '">' + item.nickName + '</option>');
      });
    },
    onGetTotalUserList: function (roomId, userList) {
      $userList = userList;
      $('#memberList').html('');
      $userList.forEach(function (item) {
        item.idName !== window._config.idName && $('#memberList').append('<option value="' + item.idName + '">' + item.nickName + '</option>');
      });
      console.log('onGetTotalUserList', roomId, userList);
    },
    onRecvRoomMsg: function (chat_data, server_msg_id, ret_msg_id) {
      console.log('onRecvRoomMsg', chat_data, server_msg_id, ret_msg_id);
    },
    onRecvReliableMessage: function (type, seq, data) {
      console.log('onRecvReliableMessage', type, seq, data);
    },
    onRecvBigRoomMessage: function (messageList, roomId) {
      console.log('onRecvBigRoomMessage', messageList, roomId);
    },
    onRecvCustomCommand: function (from_userid, from_idname, custom_content) {
      console.log('onRecvCustomCommand', from_userid, from_idname, custom_content);
    },
  }

  for (var key in _config) {
    zg[key] = _config[key]
  }

}


function leaveRoom () {
  console.info('leave room  and close stream');

  isPreviewed && zg.stopPreview(previewVideo);

  isPublish && zg.stopPublishingStream(_config.idName);
  isPreviewed = false;
  isLogin = false;
  isPublish = false;
  zg.logout();
  clearPlay()
}

$(function () {

  console.log(ZegoClient.getCurrentVersion());
  ZegoClient.supportDetection(result => {
    console.log(result)
    if (!result.capture) {
      alert("当前浏览器不支持获取摄像头麦克风设备")
    }
    if ((result.videoDecodeType.H264 || result.videoDecodeType.VP8) && result.webRtc) {
      //初始化sdk
      init();

      $('#loginHall').click(function () {
        openHall()
      })

      $('#logoutHall').click(function () {
        leaveRoom()
      })

      $('#createRoom').click(function () {
        //以坐席角色创建房间
        zg.enterRoom($('#roomId').val(), 1, streamList => {
          isLogin = true;
          //限制房间最多人数，原因：视频软解码消耗cpu，浏览器之间能支撑的个数会有差异，太多会卡顿
          if (streamList.length >= 4) {
            alert('房间太拥挤，换一个吧！');
            leaveRoom();
            return;
          }
          streamId = _config.idName;
          play(streamList)
        }, err => {
          alert(err.code + err.msg)
        });

      })

      $('#enterRoom').click(function () {
        zg.enterRoom($('#roomId').val(), 0, streamList => {
          console.log('streamList:', streamList)
          isLogin = true
          streamId = _config.idName;
          play(streamList)
        }, err => {
          alert(err.code + err.msg)
        });
      })

      $('#startPublishing').click(function () {
        if (isLogin) {
          console.warn('开始推流');
          zg.startPreview(previewVideo, getPreviewConfig());
          isPreviewed = true
          publish();
        }
      });


      $('#stopPublishing').click(function () {
        zg.stopPublishingStream(_config.idName);
        console.warn('已停止推流');
      });

      $('#leaveRoom').click(function () {
        console.info('leave room  and close stream');

        zg.stopPreview(previewVideo) && zg.stopPublishingStream(_config.idName);
        clearPlay()
        zg.leaveRoom()
      });

    }
  }, err => {
    alert("不支持222");
    alert(err)
  })

});

function setConfig (zg) {
  //测试用代码，客户请忽略  start
  if (location.search) {
    let _arr_config = location.search.substr(1).split('&');
    _arr_config.forEach(function (item) {
      var key = item.split('=')[0], value = item.split('=')[1];

      if (value && _config.hasOwnProperty(key)) {
        _config[key] = decodeURIComponent(value);
      } else if (key == 'tokenUrl' && value) {
        tokenUrl = value
      } else if (key == 'apiDomain' && value) {
        apiDomain = value
      }
    });
  }
  //测试用代码，客户请忽略  end

  //console.log('tokenUrl:' + tokenUrl)
  console.log("config param:" + JSON.stringify(_config));

  _config.appid = _config.appid * 1;
  _config.testEnvironment = !!(_config.testEnvironment * 1);
}

function getRemoteVideo () {
  const remoteVideoContainer = document.getElementById('remoteVideoContainer')
  let remoteVideo = document.getElementById('remoteVideo')
  remoteVideo && remoteVideoContainer.removeChild(remoteVideo)
  remoteVideo = document.createElement('video')
  remoteVideo.id = 'remoteVideo'
  remoteVideo.autoplay = true
  remoteVideo.controls = true
  remoteVideo.playsInline = true
  remoteVideo.muted = true
  remoteVideoContainer.appendChild(remoteVideo)

  return remoteVideo
}

