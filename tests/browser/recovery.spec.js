import { test, expect } from '@playwright/test';
import { createDevServer } from '../../scripts/serve.mjs';
let server;
test.beforeAll(async () => { server=createDevServer(); await new Promise(r=>server.listen(4176,'127.0.0.1',r)); });
test.afterAll(async () => { server.closeAllConnections(); await new Promise(r=>server.close(r)); });
const recovery = '/admin/reset-password.html#type=recovery&access_token=recovery-token&refresh_token=refresh-token';
async function mock(page, options={}) {
  await page.route('**/config/supabase-config.js',r=>r.fulfill({contentType:'text/javascript',body:"export const SUPABASE_URL='https://test.supabase.co';export const SUPABASE_PUBLISHABLE_KEY='sb_publishable_01234567890123456789';"}));
  await page.route('https://esm.sh/**',r=>r.fulfill({contentType:'text/javascript',body:`
    export function createClient(url,key,options){
      const settings=${JSON.stringify(options)};
      const user={id:'recovery-user',email:'editor@example.test'};
      const hash=new URLSearchParams(location.hash.slice(1));
      let session=localStorage.getItem('auth-test-session')?{user,access_token:'normal-token'}:null;
      const valid=options.auth.detectSessionInUrl&&hash.get('access_token')==='recovery-token'&&!settings.expired;
      if(valid){session={user,access_token:'recovery-token'};localStorage.setItem('auth-test-session','1');}
      let listener=()=>{};let logoutAttempts=0;
      window.authCalls={updates:0,recoveries:0,roleReads:0,detect:options.auth.detectSessionInUrl};
      return {auth:{
        onAuthStateChange(fn){listener=fn;if(valid&&!settings.missedEvent)fn('PASSWORD_RECOVERY',session);return {data:{subscription:{unsubscribe(){listener=()=>{};}}}};},
        getSession:async()=>({data:{session},error:null}),
        getUser:async()=>({data:{user:session&&!settings.invalidUser?user:null},error:null}),
        resetPasswordForEmail:async(email,opts)=>{window.authCalls.recoveries++;window.authCalls.redirectTo=opts.redirectTo;return {error:settings.sendError?{code:'over_email_send_rate_limit'}:null};},
        updateUser:async({password})=>{window.authCalls.updates++;await new Promise(r=>setTimeout(r,120));if(settings.updateError)return {error:{code:settings.updateError}};localStorage.setItem('auth-test-password',password);return {data:{user},error:null};},
        signOut:async()=>{if(settings.throwLogout&&logoutAttempts++===0)throw new Error('network');session=null;localStorage.removeItem('auth-test-session');listener('SIGNED_OUT',null);return {error:null};},
        signInWithPassword:async({password})=>{if(password!==(localStorage.getItem('auth-test-password')||'old-password'))return {error:{message:'invalid'}};session={user,access_token:'normal-token'};localStorage.setItem('auth-test-session','1');return {error:null};}
      },rpc:async()=>{window.authCalls.roleReads++;return {data:true,error:null};},
      from(){const chain={select(){return this;},order(){return this;},limit(){return this;},eq(){return this;},then(r){return Promise.resolve({data:[],count:0,error:null}).then(r);}};return chain;}};
    }
  `}));
}
test('envio usa origin atual, erro amigável e recuperação não exige profiles',async({page})=>{
 await mock(page);
 await page.goto('/admin/login.html#recovery');
 await page.getByLabel('E-mail de recuperação').fill('editor@example.test');
 await page.getByRole('button',{name:'Enviar link de recuperação'}).click();
 await expect(page.locator('[data-recovery-message]')).toContainText('Se houver uma conta');
 expect(await page.evaluate(()=>window.authCalls.redirectTo)).toBe('http://127.0.0.1:4176/admin/reset-password.html');
 expect(await page.evaluate(()=>window.authCalls.roleReads)).toBe(0);
});
test('fluxo completo: validação, submit único, sucesso e login com senha nova',async({page})=>{
 await mock(page);
 await page.goto(recovery);
 await expect(page.locator('#reset-form')).toBeVisible();
 expect(await page.evaluate(()=>window.authCalls.roleReads)).toBe(0);
 expect(new URL(page.url()).hash).toBe('');
 await page.getByRole('button',{name:'ATUALIZAR SENHA'}).click();
 await expect(page.locator('[data-message]')).toContainText('Preencha');
 await page.getByLabel('Nova senha',{exact:true}).fill('abc');
 await page.getByLabel('Confirmar nova senha').fill('abc');
 await page.getByRole('button',{name:'ATUALIZAR SENHA'}).click();
 await expect(page.locator('[data-message]')).toContainText('8 caracteres');
 await page.getByLabel('Nova senha',{exact:true}).fill('nova-senha-segura');
 await page.getByLabel('Confirmar nova senha').fill('outra-senha');
 await page.getByRole('button',{name:'ATUALIZAR SENHA'}).click();
 await expect(page.locator('[data-message]')).toContainText('iguais');
 expect(await page.evaluate(()=>window.authCalls.updates)).toBe(0);
 await page.getByLabel('Confirmar nova senha').fill('nova-senha-segura');
 await page.getByRole('button',{name:'Mostrar senhas'}).click();
 await expect(page.locator('#new-password')).toHaveAttribute('type','text');
 await page.locator('#reset-form').evaluate(f=>{f.requestSubmit();f.requestSubmit();});
 await expect(page.getByRole('button',{name:'ATUALIZAR SENHA'})).toBeDisabled();
 await expect(page.locator('[data-message]')).toContainText('Sua senha foi atualizada com sucesso.');
 expect(await page.evaluate(()=>window.authCalls.updates)).toBe(1);
 await expect(page).toHaveURL(/login.html$/);
 await expect(page.locator('[data-message]')).toContainText('Entre com sua nova senha');
 await page.getByLabel('E-mail',{exact:true}).fill('editor@example.test');
 await page.getByLabel('Senha',{exact:true}).fill('old-password');
 await page.getByRole('button',{name:'Entrar no painel'}).click();
 await expect(page.locator('[data-message]')).toContainText('Não foi possível entrar');
 await page.getByLabel('Senha',{exact:true}).fill('nova-senha-segura');
 await page.getByRole('button',{name:'Entrar no painel'}).click();
 await expect(page).toHaveURL(/admin\/index.html$/);
});
for(const scenario of ['missing','expired','normal-session','wrong-type','invalid-user','missed-event']){
 test('recuperação: '+scenario,async({page})=>{
  await mock(page,{expired:scenario==='expired',invalidUser:scenario==='invalid-user',missedEvent:scenario==='missed-event'});
  if(scenario==='normal-session') await page.addInitScript(()=>localStorage.setItem('auth-test-session','1'));
  await page.goto(scenario==='missing'||scenario==='normal-session'?'/admin/reset-password.html':scenario==='wrong-type'?recovery.replace('type=recovery','type=signup'):recovery);
  if(scenario==='missed-event')await expect(page.locator('#reset-form')).toBeVisible();
  else {
   await expect(page.locator('#reset-form')).toBeHidden();
   await expect(page.locator('[data-message]')).toContainText('inválido ou expirou');
   await page.getByRole('link',{name:'SOLICITAR NOVO LINK'}).click();
   await expect(page.locator('#recovery')).toHaveAttribute('open','');
  }
 });
}
test('falhas de envio e senha fraca permitem nova tentativa',async({page})=>{
 await mock(page,{sendError:true,updateError:'weak_password'});
 await page.goto('/admin/login.html#recovery');
 await page.getByLabel('E-mail de recuperação').fill('editor@example.test');
 await page.getByRole('button',{name:'Enviar link de recuperação'}).click();
 await expect(page.locator('[data-recovery-message]')).toContainText('Não foi possível enviar');
 await page.goto(recovery);
 await page.getByLabel('Nova senha',{exact:true}).fill('nova-senha-segura');
 await page.getByLabel('Confirmar nova senha').fill('nova-senha-segura');
 await page.getByRole('button',{name:'ATUALIZAR SENHA'}).click();
 await expect(page.locator('[data-message]')).toContainText('mais forte');
 await expect(page.getByRole('button',{name:'ATUALIZAR SENHA'})).toBeEnabled();
});
for(const width of [375,390,430,768,1440]){
 test('redefinição responsiva '+width,async({page},info)=>{
  await mock(page);await page.setViewportSize({width,height:900});await page.goto(recovery);
  await expect(page.locator('#reset-form')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('reset.png'),fullPage:true});
 });
}

test('senha atualizada com falha de logout permite encerrar sessão sem repetir update',async({page})=>{
 await mock(page,{throwLogout:true});
 await page.goto(recovery);
 await page.getByLabel('Nova senha',{exact:true}).fill('nova-senha-segura');
 await page.getByLabel('Confirmar nova senha').fill('nova-senha-segura');
 await page.getByRole('button',{name:'ATUALIZAR SENHA'}).click();
 await expect(page.locator('[data-message]')).toContainText('Não foi possível encerrar');
 expect(await page.evaluate(()=>window.authCalls.updates)).toBe(1);
 await page.getByRole('button',{name:'Encerrar sessão e voltar ao login'}).click();
 await expect(page).toHaveURL(/login.html$/);
 await expect(page.locator('[data-message]')).toContainText('Senha atualizada');
 await page.reload();
 await expect(page.locator('[data-message]')).not.toContainText('Senha atualizada');
});
