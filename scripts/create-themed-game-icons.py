"""Draw the 19 game-specific resource icons as reproducible geometric artwork."""
from pathlib import Path
from PIL import Image, ImageDraw
import math

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'game-icons'
S = 3
WHITE='#f7fbff'; SOFT='#b6c9df'; GOLD='#ffd773'; BLUE='#65c8ff'; GREEN='#83ecc1'; RED='#ff8789'; PINK='#ffa5da'; DARK='#13273b'

class Art:
    def __init__(self, bg):
        self.im=Image.new('RGBA',(256*S,256*S),(0,0,0,0)); self.d=ImageDraw.Draw(self.im)
        self.round((0,0,256,256),54,bg)
        self.round((8,8,248,248),48,None,'#ffffff28',2)
    def box(self,b): return tuple(round(x*S) for x in b)
    def line(self,points,fill=WHITE,width=7):
        p=[(round(x*S),round(y*S)) for x,y in points]; self.d.line(p,fill=fill,width=width*S,joint='curve')
        for x,y in [p[0],p[-1]]: self.d.ellipse((x-width*S/2,y-width*S/2,x+width*S/2,y+width*S/2),fill=fill)
    def circle(self,x,y,r,fill=None,outline=None,width=4): self.d.ellipse(self.box((x-r,y-r,x+r,y+r)),fill=fill,outline=outline,width=width*S)
    def round(self,b,r,fill=None,outline=None,width=4): self.d.rounded_rectangle(self.box(b),radius=r*S,fill=fill,outline=outline,width=width*S)
    def poly(self,points,fill,outline=None): self.d.polygon([(int(x*S),int(y*S)) for x,y in points],fill=fill,outline=outline)
    def arc(self,b,start,end,fill,width=7): self.d.arc(self.box(b),start,end,fill=fill,width=width*S)
    def save(self,id): self.im.resize((256,256),Image.Resampling.LANCZOS).save(OUT/(id+'.png'),optimize=True)

def network(a):
    levels=[[(52,80),(52,128),(52,176)],[(126,62),(126,106),(126,150),(126,194)],[(202,90),(202,166)]]
    for left,right in zip(levels,levels[1:]):
        for x,y in left:
            for u,v in right:a.line([(x,y),(u,v)],'#597f9f',3)
    for i,level in enumerate(levels):
        for x,y in level:a.circle(x,y,11,[BLUE,GREEN,GOLD][i],WHITE,2)

def hexagon(x,y,r):return [(x+r*math.cos(math.radians(60*i)),y+r*math.sin(math.radians(60*i))) for i in range(6)]

def render(id):
    backgrounds={'hex-cell-lab':'#183b43','langtons-ant':'#3d2940','turbowarp-neural-network':'#1d3453','turbowarp-logic-lab':'#283052','lights-out-matrix':'#2a2442','learning-machine':'#183d42','compass-polygon-studio':'#243a59','fourier-drawing-studio':'#302b50','ai-racing-lab':'#303b43','turbowarp-life-lab':'#21463c','turbowarp-turing-lab':'#3b3046','snake-speed':'#264a3a','turbowarp-graph-lab':'#253f55','fixed-point-workshop':'#293653','sokoban-ai-lab':'#4c372d','tape-language-lab':'#34354d','pixel-frame':'#3b3051','territory-conquest':'#393b4f','cube-step-solver':'#30374c'}
    a=Art(backgrounds[id])
    if id=='hex-cell-lab':
        for y in range(3):
            for x in range(3):
                cx=62+x*59+(29 if y%2 else 0); cy=69+y*57
                a.poly(hexagon(cx,cy,29),[GREEN,BLUE,'#437b80',GOLD][(x+2*y)%4]);a.line(hexagon(cx,cy,29)+[hexagon(cx,cy,29)[0]],DARK,3)
    elif id=='langtons-ant':
        for y in range(4):
            for x in range(4): a.round((35+x*46,35+y*46,77+x*46,77+y*46),4,('#eee8db' if (x+y)%2 else '#65526d'))
        a.circle(129,130,25,RED);a.circle(156,113,16,RED);a.line([(157,100),(167,87)],WHITE,4);a.line([(162,102),(180,100)],WHITE,4)
        for y in (117,130,144):a.line([(119,y),(102,y-12)],DARK,4);a.line([(140,y),(157,y+12)],DARK,4)
    elif id=='turbowarp-neural-network': network(a)
    elif id=='turbowarp-logic-lab':
        a.line([(37,91),(94,91)],BLUE,8);a.line([(37,163),(94,163)],PINK,8);a.line([(163,127),(221,127)],GOLD,8)
        a.poly([(93,63),(138,63),(160,73),(175,94),(180,127),(175,160),(160,181),(138,191),(93,191)],GREEN);a.circle(193,127,10,DARK,GOLD,4)
        a.circle(38,91,9,BLUE);a.circle(38,163,9,PINK);a.circle(221,127,9,GOLD)
    elif id=='lights-out-matrix':
        for y in range(3):
            for x in range(3):
                on=(x,y) in {(0,0),(2,0),(1,1),(0,2),(2,2)}; a.round((43+x*59,43+y*59,93+x*59,93+y*59),10,GOLD if on else '#47516b')
        a.circle(128,128,10,WHITE)
    elif id=='learning-machine':
        a.round((49,67,207,181),27,'#a6e7d5');a.round((64,83,192,163),15,DARK);a.circle(96,119,10,BLUE);a.circle(159,119,10,GOLD);a.line([(107,145),(150,145)],GREEN,6);a.line([(128,65),(128,43)],WHITE,6);a.circle(128,40,8,PINK)
        a.line([(68,191),(54,210)],WHITE,7);a.line([(188,191),(202,210)],WHITE,7)
    elif id=='compass-polygon-studio':
        a.poly([(53,195),(126,49),(206,195)],'#49658c');a.line([(53,195),(126,49),(206,195),(53,195)],BLUE,5)
        a.circle(126,49,9,GOLD);a.line([(126,49),(77,205)],WHITE,8);a.line([(126,49),(180,205)],WHITE,8);a.circle(126,49,7,RED);a.arc((69,96,187,214),15,165,GOLD,4)
    elif id=='fourier-drawing-studio':
        a.circle(95,128,53,None,'#728bae',4);a.circle(145,128,29,None,GREEN,4);a.line([(95,128),(148,128),(171,111)],WHITE,5);a.circle(171,111,6,GOLD)
        points=[(165+i*2,130+26*math.sin(i*0.23)) for i in range(31)];a.line(points,PINK,6)
    elif id=='ai-racing-lab':
        a.round((28,39,228,217),53,'#1c2732');a.round((51,58,205,198),43,None,SOFT,19);a.round((88,91,168,163),22,'#1c2732')
        a.line([(128,57),(128,72)],WHITE,5);a.line([(128,184),(128,198)],WHITE,5)
        a.round((147,69,181,87),7,RED);a.circle(155,91,5,DARK);a.circle(175,91,5,DARK)
    elif id=='turbowarp-life-lab':
        for y in range(5):
            for x in range(5):
                alive=(x,y) in {(1,0),(2,1),(0,2),(1,2),(2,2),(4,3),(3,4),(4,4)}
                a.round((38+x*37,38+y*37,70+x*37,70+y*37),6,GREEN if alive else '#345d56')
    elif id=='turbowarp-turing-lab':
        for i in range(5):
            x=24+42*i;a.round((x,116,x+38,166),7,WHITE);a.circle(x+19,141,6,DARK if i in (0,2,4) else BLUE)
        a.poly([(113,69),(143,69),(128,99)],RED);a.line([(128,45),(128,68)],GOLD,6);a.round((61,185,195,209),8,'#64819b')
    elif id=='snake-speed':
        a.line([(58,173),(101,173),(101,106),(159,106),(159,68),(197,68)],GREEN,23);a.circle(197,68,13,GREEN);a.circle(201,64,3,DARK);a.circle(192,55,9,RED);a.line([(38,80),(66,80)],GOLD,5);a.line([(32,96),(54,96)],GOLD,5)
    elif id=='turbowarp-graph-lab':
        a.line([(44,200),(214,200)],SOFT,4);a.line([(59,216),(59,40)],SOFT,4)
        a.line([(64+i*3,170-75*math.sin(i*0.07)) for i in range(47)],BLUE,7);a.line([(69+i*3,191-(i-17)**2*.115) for i in range(45)],PINK,5)
        a.circle(149,109,8,GOLD)
    elif id=='fixed-point-workshop':
        a.round((34,74,222,181),20,'#19263d',BLUE,4)
        for i,x in enumerate((67,100,139,172,204)):a.circle(x,125,10,GREEN if i in (0,2,4) else '#52617b')
        a.circle(119,146,5,GOLD);a.line([(61,191),(195,191)],SOFT,4);a.line([(118,185),(118,199)],GOLD,5)
    elif id=='sokoban-ai-lab':
        for x,y in [(45,48),(91,48),(137,48),(183,48),(45,94),(183,94),(45,140),(183,140),(45,186),(91,186),(137,186),(183,186)]:a.round((x,y,x+40,y+40),5,'#8a7060')
        a.round((94,96,137,139),5,GOLD);a.line([(98,100),(133,135)],'#9d6d39',4);a.line([(133,100),(98,135)],'#9d6d39',4);a.circle(160,162,13,GREEN);a.circle(160,162,5,DARK);a.circle(70,162,13,BLUE)
    elif id=='tape-language-lab':
        for i in range(5):a.round((23+i*43,100,62+i*43,154),6,WHITE)
        a.poly([(108,66),(148,66),(128,90)],GOLD)
        a.line([(38,125),(49,125)],DARK,4);a.line([(43,120),(43,130)],DARK,4);a.line([(82,125),(93,125)],DARK,4);a.circle(128,127,5,RED);a.line([(169,119),(178,125),(169,131)],DARK,4);a.line([(211,119),(202,125),(211,131)],DARK,4)
    elif id=='pixel-frame':
        a.round((48,38,208,218),12,'#182236',SOFT,5)
        for x,y,c in [(72,70,RED),(96,70,GOLD),(120,70,GREEN),(144,70,BLUE),(72,94,PINK),(96,94,BLUE),(120,94,GOLD),(144,94,GREEN),(96,118,RED),(120,118,PINK),(144,118,BLUE),(120,142,GOLD)]:a.round((x,y,x+20,y+20),2,c)
        a.line([(71,184),(184,184)],WHITE,5)
    elif id=='territory-conquest':
        a.poly([(33,64),(89,43),(120,69),(166,41),(222,64),(222,190),(167,213),(122,189),(84,214),(33,191)],'#657289')
        a.poly([(33,64),(89,43),(118,68),(99,121),(33,130)],BLUE);a.poly([(118,68),(166,41),(222,64),(222,125),(159,127),(99,121)],RED);a.poly([(33,130),(99,121),(122,189),(84,214),(33,191)],GREEN);a.poly([(99,121),(159,127),(222,125),(222,190),(167,213),(122,189)],GOLD)
        a.line([(89,43),(118,68),(99,121),(122,189)],DARK,5);a.line([(33,130),(99,121),(159,127),(222,125)],DARK,5);a.line([(118,68),(166,41)],DARK,5)
    elif id=='cube-step-solver':
        a.poly([(128,35),(208,79),(128,124),(48,79)],'#fff2cc');a.poly([(48,79),(128,124),(128,218),(48,172)],'#ff7d74');a.poly([(128,124),(208,79),(208,172),(128,218)],'#72c6f2')
        for t in (1/3,2/3):
            a.line([(48+80*t,79-44*t),(128+80*t,124-45*t)],DARK,4);a.line([(48+80*t,79+45*t),(48+80*t,172+46*t)],DARK,4);a.line([(48,79+93*t),(128,124+94*t),(208,79+93*t)],DARK,4);a.line([(128+80*t,124-45*t),(128+80*t,218-46*t)],DARK,4)
        a.line([(48,79),(128,35),(208,79),(208,172),(128,218),(48,172),(48,79),(128,124),(208,79)],DARK,5);a.line([(128,124),(128,218)],DARK,5)
    else: raise ValueError(id)
    a.save(id)

if __name__=='__main__':
    for name in ('hex-cell-lab','langtons-ant','turbowarp-neural-network','turbowarp-logic-lab','lights-out-matrix','learning-machine','compass-polygon-studio','fourier-drawing-studio','ai-racing-lab','turbowarp-life-lab','turbowarp-turing-lab','snake-speed','turbowarp-graph-lab','fixed-point-workshop','sokoban-ai-lab','tape-language-lab','pixel-frame','territory-conquest','cube-step-solver'): render(name)
