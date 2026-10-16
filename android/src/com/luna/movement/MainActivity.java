package com.luna.movement;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.*;
import java.io.*;
import java.util.*;

/** Offline scene host. All requests are served from packaged assets on a secure origin. */
public final class MainActivity extends Activity {
    private WebView web;
    private static final String HOST="luna.local";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web=new WebView(this);
        web.setBackgroundColor(0xff182636);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false); // Game start is a user gesture; dialogue advances must play immediately offline.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!HOST.equals(request.getUrl().getHost())) return response(403,"Forbidden","text/plain",new ByteArrayInputStream(new byte[0]),0);
                String path=request.getUrl().getPath();
                if(path==null||path.equals("/"))path="/index.html";
                if(path.contains(".."))return response(403,"Forbidden","text/plain",new ByteArrayInputStream(new byte[0]),0);
                try {
                    InputStream stream=getAssets().open(path.substring(1));
                    String type=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".glb")?"model/gltf-binary":path.endsWith(".html")?"text/html":path.endsWith(".mp3")?"audio/mpeg":path.endsWith(".png")?"image/png":path.endsWith(".json")?"application/json":"application/octet-stream";
                    return response(200,"OK",type,stream,stream.available());
                } catch(IOException e){return response(404,"Not Found","text/plain",new ByteArrayInputStream(new byte[0]),0);}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !HOST.equals(request.getUrl().getHost());}
        });
        web.setWebChromeClient(new WebChromeClient());
        setContentView(web);immersive();web.loadUrl("https://"+HOST+"/index.html");
    }
    private WebResourceResponse response(int code,String reason,String type,InputStream stream,int size){
        Map<String,String> headers=new HashMap<>();headers.put("Content-Length",Integer.toString(size));headers.put("Cache-Control","no-cache");
        // GLTFLoader fetches embedded textures through blob URLs with ImageBitmapLoader.
        // These requests require connect-src permission as well as img-src permission.
        headers.put("Content-Security-Policy","default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:");
        return new WebResourceResponse(type,type.startsWith("text/")||type.contains("javascript")?"UTF-8":null,code,reason,headers,stream);
    }
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
    @Override public void onWindowFocusChanged(boolean hasFocus){super.onWindowFocusChanged(hasFocus);if(hasFocus)immersive();}
    @Override protected void onPause(){if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
    @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();web=null;}super.onDestroy();}
}
