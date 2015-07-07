/*\
 * weapon
 * 
 * generalization over light and heavy weapons
\*/

define(['LF/livingobject','LF/global','F.core/util'],
function(livingobject, Global, Futil)
{
var GC=Global.gameplay;

/*\
 * weapon
 [ class ]
 * note that this is a template class
 | var lightweapon = weapon('lightweapon');
 | var heavyweapon = weapon('heavyweapon');
\*/
function weapon(type)
{
	var states=
	{
		'generic':function(event,K)
		{	var $=this;
			switch (event) {

			case 'TU':

				$.interaction();

				switch( $.cur_state())
				{
					case 1001:
					case 2001:
						//I am passive! so I dont need to care states of myself
					break;

					default:
						//dynamics: position, friction, gravity
						$.mech.dynamics();
					break;
				}

				var ps=$.ps;
				if( ps.y===0 && ps.vy>0) //fell onto ground
				{
					if( this.mech.speed() > GC.weapon.bounceup.limit)
					{	//bounceup
						if( $.light)
						{
							ps.vy = 0;
							$.trans.frame(70);
						}
						if( $.heavy)
							ps.vy = GC.weapon.bounceup.speed.y;
						if( ps.vx) ps.vx = (ps.vx>0?1:-1)*GC.weapon.bounceup.speed.x;
						if( ps.vz) ps.vz = (ps.vz>0?1:-1)*GC.weapon.bounceup.speed.z;
					}
					else
					{
						$.team=0;
						ps.vy=0; //set to zero
						if( $.light)
							$.trans.frame(70); //just_on_ground
						if( $.heavy)
							$.trans.frame(21); //just_on_ground
						$.health.hp -= $.data.bmp.weapon_drop_hurt;
					}
					ps.zz=0;
				}
			break;
		}},

		'1004':function(event,K) //light
		{	var $=this;
			switch (event) {

			case 'frame':
				if( $.frame.N===64) //on ground
					$.team=0; //loses team
			break;
		}},

		'2000':function(event,K) //heavy
		{	var $=this;
			switch (event) {

			case 'frame':
				if( $.frame.N === 21) //just_on_ground
					$.trans.set_next(20);
			break;
		}},

		'2004':function(event,K) //heavy
		{	var $=this;
			switch (event) {

			case 'frame':
				if( $.frame.N === 20) //on_ground
					$.team=0;
			break;
		}}
	};

	//inherit livingobject
	function typeweapon(config,data,thisID)
	{
		var $=this;
		// chain constructor
		livingobject.call(this,config,data,thisID);
		for( var i=0; i<$.sp.ani.length; i++)
		{	//fix border issue
			$.sp.ani[i].config.borderleft=1;
			$.sp.ani[i].config.bordertop=0;
			$.sp.ani[i].config.borderright=2;
			$.sp.ani[i].config.borderbottom=2;
		}
		$.hold=
		{
			obj: null //character who hold me
		};
		$.setup();
	}
	typeweapon.prototype = new livingobject();
	typeweapon.prototype.constructor = typeweapon;
	typeweapon.prototype.light = type==='lightweapon';
	typeweapon.prototype.heavy = type==='heavyweapon';
	typeweapon.prototype.type = type;
	typeweapon.prototype.states = states;

	typeweapon.prototype.interaction=function()
	{
		var $=this;
		var ITR=Futil.make_array($.frame.D.itr);

		if( $.team!==0)
		if(($.heavy) ||
		   ($.light && $.cur_state()===1002))
		for( var j in ITR)
		{	//for each itr tag
			if( ITR[j].kind===0) //kind 0
			{
				var vol=$.mech.volume(ITR[j]);
				var hit= $.scene.query(vol, $, {tag:'body', not_team:$.team});
				for( var k in hit)
				{	//for each being hit
					var itr_rest;
					if( ITR[j].arest!==undefined || ITR[j].vrest!==undefined)
						itr_rest=ITR[j];
					else
						itr_rest=GC.default.weapon;
					//if( itr_rest.arest) itr_rest.arest+=20; //what is this line for?
					//
					/*console.log('I='+$.uid+', he='+hit[k].uid+
						', arest='+itr_rest.arest+
						', vrest='+itr_rest.vrest+
						', itr.arest='+$.itr.arest+
						', itr.vrest='+$.itr.vrest[hit[k].uid]);*/
					if( $.itr_rest_test( hit[k].uid, itr_rest))
					if( hit[k].hit(ITR[j],$,{x:$.ps.x,y:$.ps.y,z:$.ps.z},vol))
					{	//hit you!
						//console.log('hit'+'$.state='+$.cur_state());
						var ps=$.ps;
						var vx=(ps.vx===0?0:(ps.vx>0?1:-1));
						if( $.light)
						{
							ps.vx = vx * GC.weapon.hit.vx;
							ps.vy = GC.weapon.hit.vy;
						}
						$.itr_rest_update( hit[k], hit[k].uid, itr_rest);
						//create an effect
						var timeout;
						if( $.light) timeout=2;
						if( $.heavy) timeout=4;
						$.effect.dvx=0;
						$.effect.dvy=0;
						$.effect_stuck(0,timeout);
					}
				}
			}
			//kind 5 is handled in `act()`
		}
	}

	/** @protocol caller hits callee
		@param ITR the itr object in data
		@param att reference of attacker
		@param attps position of attacker
		@param rect the hit rectangle where visual effects should appear
	 */
	typeweapon.prototype.hit=function(ITR, att, attps, rect)
	{
		var $=this;
		if( $.holder)
			return false;

		var accept=false;
		if( $.light)
		{
			if( $.cur_state()===1002) //throwing
			{
				accept=true;
				if( (att.dirh()>0)!==($.ps.vx>0)) //head-on collision
					$.ps.vx *= GC.weapon.reverse.factor.vx;
				$.ps.vy *= GC.weapon.reverse.factor.vy;
				$.ps.vz *= GC.weapon.reverse.factor.vz;
				$.team = att.team; //change to the attacker's team
			}
			else if( $.cur_state()===1004) //on_ground
			{
				//var asp = att.mech.speed();
				//$.ps.vx= asp* GC.weapon.gain.factor.x * (att.ps.vx>0?1:-1);
				//$.ps.vy= asp* GC.weapon.gain.factor.y;
				if( att.type==='lightweapon' || att.type==='heavyweapon')
				{
					accept=true;
					$.ps.vx= (att.ps.vx?(att.ps.vx>0?1:-1):0)*GC.weapon.bounceup.speed.x;
					$.ps.vz= (att.ps.vz?(att.ps.vz>0?1:-1):0)*GC.weapon.bounceup.speed.z;
				}
			}
		}

		var fall= ITR.fall!==undefined? ITR.fall: GC.default.fall.value;
		if( $.heavy)
		{
			if( $.cur_state()===2004) //on_ground
			{
				accept=true;
				if( fall<30)
					$.effect_create(0, GC.effect.duration);
				else if( fall<GC.fall.KO)
					$.ps.vy= GC.weapon.soft_bounceup.speed.y;
				else
				{
					$.ps.vy= GC.weapon.bounceup.speed.y;
					if( att.ps.vx) $.ps.vx= (att.ps.vx>0?1:-1)*GC.weapon.bounceup.speed.x;
					if( att.ps.vz) $.ps.vz= (att.ps.vz>0?1:-1)*GC.weapon.bounceup.speed.z;
					$.trans.frame(999);
				}
			}
			else if( $.cur_state()===2000) //in_the_sky
			{
				if( fall>=GC.fall.KO)
				{
					accept=true;
					if( (att.dirh()>0)!==($.ps.vx>0)) //head-on collision
						$.ps.vx *= GC.weapon.reverse.factor.vx;
					$.ps.vy *= GC.weapon.reverse.factor.vy;
					$.ps.vz *= GC.weapon.reverse.factor.vz;
					$.team = att.team; //change to the attacker's team
				}
			}
		}
		if( accept)
			$.visualeffect_create( 0, rect, (attps.x < $.ps.x), (fall<GC.fall.KO?1:2));
		return accept;
	}

	/** @protocol being held in a character's hand
		@param att holder's reference
		@param wpoint data
		@param holdpoint data
	 */
	typeweapon.prototype.act=function(att,wpoint,holdpoint)
	{
		var $=this;
		var fD = $.frame.D;
		var result={};

		if( $.data.frame[wpoint.weaponact]) //if that frame exists
		{
			$.trans.frame(wpoint.weaponact);
			$.trans.trans(); //update immediately
		}

		if( fD.wpoint && fD.wpoint.kind===2)
		{
			if( wpoint.dvx) $.ps.vx = att.dirh() * wpoint.dvx;
			if( wpoint.dvz) $.ps.vz = att.dirv() * wpoint.dvz;
			if( wpoint.dvy) $.ps.vy = wpoint.dvy;
			if( $.ps.vx || $.ps.vy || $.ps.vz)
			{	//gaining velocity; flying away
				var imx,imy; //impulse
				if( $.light)
				{
					imx=58; imy=-15;
				}
				if( $.heavy)
				{
					imx=48; imy=-40;
				}
				$.mech.set_pos(
					att.ps.x + att.dirh() * imx,
					att.ps.y + imy,
					att.ps.z + $.ps.vz );
				$.ps.zz=1;
				if( $.light)
					$.trans.frame(40);
				if( $.heavy)
					$.trans.frame(999);
				$.trans.trans(); //update immediately
				$.holder=null;
				result.thrown=true;
			}

			if( !result.thrown)
			{
				var wpoint_cover = wpoint.cover!==undefined?wpoint.cover:GC.default.wpoint.cover;
				if( wpoint_cover===1)
					$.ps.zz = -1;
				else
					$.ps.zz = 0;

				$.switch_dir(att.ps.dir);
				$.ps.sz = $.ps.z = att.ps.z;
				$.mech.coincideXY(holdpoint,$.mech.make_point(fD.wpoint));
				$.mech.project();
			}

			if( $.light) //attackable
			{
				if( wpoint.attacking)
				{
					var ITR=Futil.make_array(fD.itr);

					for( var j in ITR)
					{	//for each itr tag
						if( ITR[j].kind===5) //kind 5 only
						{
							var vol=$.mech.volume(ITR[j]);
							var hit= $.scene.query(vol, [$,att], {tag:'body', not_team:$.team});
							for( var k in hit)
							{	//for each being hit
								if( $.itr_rest_test( hit[k].uid, ITR[j]) &&
								  att.itr_rest_test( hit[k].uid, ITR[j]) )
								{	//if rest allows
									$.itr_rest_update( hit[k], hit[k].uid, ITR[j]);
									var citr;
									if( $.data.weapon_strength_list &&
										$.data.weapon_strength_list[wpoint.attacking])
										citr = $.data.weapon_strength_list[wpoint.attacking];
									else
										citr = ITR[j];

									if( hit[k].hit(citr,att,{x:att.ps.x,y:att.ps.y,z:att.ps.z},vol))
									{	//hit you!
										if( citr.vrest)
											result.vrest = citr.vrest;
										if( citr.arest)
											result.arest = citr.arest;
										result.hit = hit[k].uid;
									}
								}
							}
						}
					}
				}
			}
		}
		if( result.thrown)
			$.shadow.show();
		return result;
	}

	typeweapon.prototype.drop=function(dvx,dvy)
	{
		var $=this;
		$.team=0;
		$.holder=null;
		if( dvx) $.ps.vx=dvx * 0.5; //magic number
		if( dvy) $.ps.vy=dvy * 0.2;
		$.ps.zz=0;
		$.trans.frame(999);
		$.shadow.show();
	}

	typeweapon.prototype.pick=function(att)
	{
		var $=this;
		if( !$.holder)
		{
			$.holder=att;
			$.team=att.team;
			$.shadow.hide();
			return true;
		}
		return false;
	}

	typeweapon.prototype.itr_rest_update=function(obj,uid,ITR) //override livingobject.itr_rest_update
	{
		var $=this;
		var newrest;
		if( ITR.arest)
			newrest = ITR.arest;
		else if( ITR.vrest)
			newrest = ITR.vrest;
		else
			newrest = GC.default.weapon.vrest;
		if( obj.type==='heavyweapon' || obj.type==='lightweapon')
			newrest *= 2; //double the rest time for weapon-weapon hit
		$.itr.vrest[uid] = newrest;
	}

	typeweapon.prototype.vol_itr=function(kind)
	{
		function match_kind(obj)
		{
			return obj.kind==kind; //use type conversion comparison
		}
		var $=this;
		if( $.frame.D.itr)
			return $.mech.body(
				$.frame.D.itr, //make volume from itr
				match_kind //select only matched kind
			);
		else
			return $.mech.body_empty();
	}

	return typeweapon;

} //outer class weapon
return weapon;
});
